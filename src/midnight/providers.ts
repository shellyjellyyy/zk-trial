import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from "@midnight-ntwrk/ledger-v8";
import { dappConnectorProvingProvider } from "@midnight-ntwrk/midnight-js-dapp-connector-proof-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  createProofProvider,
  type MidnightProviders,
  type ProofProvider,
  type PrivateStateProvider,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
  type ZKConfigProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-utils";
import type { ContractAddress, SigningKey } from "@midnight-ntwrk/compact-runtime";
import { type OneAMConnection } from "./wallet";
import {
  NETWORK,
  NETWORK_ENDPOINTS,
  ensureNetworkRegistered,
} from "./config";

/** Circuits of the zk-trial Compact contract that can be proved. */
export type ZkTrialCircuitId = "enroll" | "getEnrollmentCount";
export type ZkTrialProviders = MidnightProviders<
  ZkTrialCircuitId,
  string,
  unknown
>;

/**
 * Transaction pipeline stages we can observe from the provider layer.
 * The UI subscribes via onTransactionStage() so progress messages reflect the
 * real pipeline ("Waiting for wallet approval…" fires exactly when the
 * wallet's balancing call is in flight, etc.) instead of guessed timings.
 */
export type TransactionStage = "balancing" | "submitting";
type StageListener = (stage: TransactionStage) => void;
let stageListener: StageListener | null = null;
export function onTransactionStage(fn: StageListener): () => void {
  stageListener = fn;
  return () => {
    if (stageListener === fn) stageListener = null;
  };
}
function emitStage(stage: TransactionStage): void {
  try {
    stageListener?.(stage);
  } catch {
    // Listener errors must never break the transaction pipeline.
  }
}

/**
 * In-memory PrivateStateProvider.
 *
 * zk-trial keeps no long-lived private state on the SDK side: every private
 * input is supplied per-call through the witnesses (see contract-api.ts). The
 * provider exists because the SDK requires the slot; storing per-contract
 * signing keys in memory for the session is all it does. Nothing medical is
 * ever written here.
 */
export function inMemoryPrivateStateProvider(): PrivateStateProvider {
  const privateStates = new Map<string, unknown>();
  const signingKeys = new Map<string, SigningKey>();
  let currentAddress = "";
  const key = (id: string) => `${currentAddress}:${id}`;

  return {
    setContractAddress(address: ContractAddress): void {
      currentAddress = address;
    },
    async set(id: string, state: unknown): Promise<void> {
      privateStates.set(key(id), state);
    },
    async get(id: string): Promise<unknown> {
      return privateStates.get(key(id)) ?? null;
    },
    async remove(id: string): Promise<void> {
      privateStates.delete(key(id));
    },
    async clear(): Promise<void> {
      for (const k of privateStates.keys()) {
        if (k.startsWith(`${currentAddress}:`)) privateStates.delete(k);
      }
    },
    async setSigningKey(address: ContractAddress, sk: SigningKey): Promise<void> {
      signingKeys.set(address, sk);
    },
    async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
      return signingKeys.get(address) ?? null;
    },
    async removeSigningKey(address: ContractAddress): Promise<void> {
      signingKeys.delete(address);
    },
    async clearSigningKeys(): Promise<void> {
      signingKeys.clear();
    },
    async exportPrivateStates() {
      throw new Error("Private state export is not used by zk-trial.");
    },
    async importPrivateStates() {
      throw new Error("Private state import is not used by zk-trial.");
    },
    async exportSigningKeys() {
      throw new Error("Signing key export is not used by zk-trial.");
    },
    async importSigningKeys() {
      throw new Error("Signing key import is not used by zk-trial.");
    },
  };
}

/**
 * ZKConfigProvider backed by static files served next to the app:
 *   {baseURL}/keys/{circuit}.prover | .verifier
 *   {baseURL}/zkir/{circuit}.bzkir
 *
 * The compiled artifacts in managed/zk-trial are copied into public/zk/ at
 * build time by scripts/copy-zk-assets.mjs so the browser can fetch them.
 */
export function makeFetchZkConfigProvider(
  baseURL: string,
): ZKConfigProvider<ZkTrialCircuitId> {
  return new FetchZkConfigProvider<ZkTrialCircuitId>(baseURL, async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    try {
      return await fetch(input, init);
    } catch (error) {
      // FetchZkConfigProvider wraps failures in ZKConfigurationReadError, which
      // hides which artifact failed — log the URL before rethrowing.
      console.error("[zk-trial] ZK artifact request failed", { url, error });
      throw error;
    }
  });
}

/**
 * Build the full provider set for a connected 1AM Wallet.
 *
 * proofProvider: prefer the wallet's own ProvingProvider (1AM proves locally
 * with the key material we hand it); fall back to the official Preprod HTTP
 * proof server if the wallet does not expose one. Balancing and submission
 * always go through the wallet.
 */
export async function createProvidersFromWallet(
  connection: OneAMConnection,
  zkConfigProvider: ZKConfigProvider<ZkTrialCircuitId>,
): Promise<ZkTrialProviders> {
  ensureNetworkRegistered();

  // Public data comes from the Preprod indexer. Wallet-reported endpoints are
  // preferred (they match what the wallet itself reads); constants are the
  // fallback so the app also works before any wallet is connected.
  const indexerHttp = connection.indexerHttpUrl || NETWORK_ENDPOINTS.indexerHttpUrl;
  const indexerWs = connection.indexerWsUrl || NETWORK_ENDPOINTS.indexerWsUrl;

  // Proof provider: wallet prover first (official dapp-connector adapter for
  // 1AM's proving service), HTTP proof server as fallback.
  let proofProvider: ProofProvider;
  const walletProver = await dappConnectorProvingProvider(
    connection.api,
    zkConfigProvider,
  ).catch(() => null);
  if (walletProver) {
    proofProvider = createProofProvider(walletProver);
  } else {
    // Fallback: explicit override, else the wallet's configured HTTP proof
    // server (ProofStation for 1AM).
    const proofServerUrl =
      process.env.NEXT_PUBLIC_PROOF_SERVER_URL ??
      connection.proverServerUri ??
      "";
    if (!proofServerUrl) {
      throw new Error(
        "No proof provider available: the wallet does not expose a proving " +
          "provider and reports no proof server URL.",
      );
    }
    proofProvider = httpClientProofProvider(
      proofServerUrl,
      zkConfigProvider,
      { timeout: 300_000 },
    );
  }

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerHttp, indexerWs),
    zkConfigProvider,
    proofProvider,
    walletProvider: {
      getCoinPublicKey: () => connection.coinPublicKey,
      getEncryptionPublicKey: () => connection.encryptionPublicKey,
      balanceTx: async (tx, _ttl?: Date): Promise<FinalizedTransaction> => {
        // Serialize (Transaction<S,P,PreBinding> -> bytes) and hand the hex to
        // the wallet, which balances fees/inputs and returns a sealed tx.
        emitStage("balancing");
        const { tx: balancedHex } = await connection.api.balanceUnsealedTransaction(
          toHex(tx.serialize()),
        );
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          "signature",
          "proof",
          "binding",
          fromHex(balancedHex),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        // The wallet relays the sealed transaction to Midnight Preprod.
        emitStage("submitting");
        await connection.api.submitTransaction(toHex(tx.serialize()));
        const ids = tx.identifiers();
        if (ids.length === 0) {
          throw new Error("Balanced transaction carries no identifiers to track.");
        }
        return ids[0];
      },
    },
  };
}

/** Deterministic signing key for contract maintenance from the participant seed. */
export function signingKeyFromSeed(seed: Uint8Array): SigningKey {
  return fromHex(toHex(seed)) as unknown as SigningKey;
}
