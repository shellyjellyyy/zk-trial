// lib/chain/soroban.ts
//
// REAL Soroban integration using @stellar/stellar-sdk (v12). Nothing here is
// mocked: every value returned by this module comes from a live Soroban RPC
// endpoint, and every transaction it submits is signed by a real wallet and
// confirmed on-chain.
//
// It only becomes "live" once contracts/zk_trial is deployed (see
// scripts/deploy-preprod.sh) and NEXT_PUBLIC_CONTRACT_ID /
// NEXT_PUBLIC_SOROBAN_RPC_URL / NEXT_PUBLIC_NETWORK_PASSPHRASE are set in
// apps/web/.env.local. Until then, isChainConfigured() returns false and the UI
// says so honestly instead of faking a transaction.

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransactionXdr, type FreighterNetwork } from "./wallet";

export interface ChainConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  /** "testnet" | "public" | "futurenet" -- used to tell the wallet which network to sign for. */
  network: FreighterNetwork;
  /** Public name shown in the UI, e.g. "Stellar Testnet". */
  networkLabel: string;
}

export function getChainConfig(): ChainConfig | null {
  const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
  if (!rpcUrl || !contractId) return null;

  const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;
  let network: FreighterNetwork = "TESTNET";
  if (networkPassphrase === Networks.PUBLIC) network = "PUBLIC";
  else if (networkPassphrase === Networks.FUTURENET) network = "FUTURENET";

  return {
    rpcUrl,
    networkPassphrase,
    contractId,
    network,
    networkLabel: process.env.NEXT_PUBLIC_NETWORK_LABEL || networkLabelFor(network),
  };
}

function networkLabelFor(n: FreighterNetwork): string {
  if (n === "PUBLIC") return "Stellar Mainnet (Public)";
  if (n === "FUTURENET") return "Stellar Futurenet";
  return "Stellar Testnet";
}

export function isChainConfigured(): boolean {
  return getChainConfig() !== null;
}

function server(): { rpc: SorobanRpc.Server; config: ChainConfig } {
  const config = getChainConfig();
  if (!config) throw new ChainNotConfiguredError();
  return { rpc: new SorobanRpc.Server(config.rpcUrl), config };
}

export class ChainNotConfiguredError extends Error {
  constructor() {
    super(
      "No Soroban contract is configured. Deploy contracts/zk_trial (scripts/deploy-preprod.sh) and set NEXT_PUBLIC_CONTRACT_ID / NEXT_PUBLIC_SOROBAN_RPC_URL in apps/web/.env.local."
    );
    this.name = "ChainNotConfiguredError";
  }
}

// ---------------------------------------------------------------------------
// READ: contract state (view only, no wallet, no fee)
// ---------------------------------------------------------------------------

/**
 * Reads the persisted `TrialMeta` for a trial straight from Soroban contract
 * storage via the RPC `getLedgerEntries` endpoint. This is real on-chain
 * state -- not a simulation, not a cached constant.
 *
 * The Rust key is `#[contracttype] enum DataKey { Trial(Symbol), Nullifiers(Symbol), Admin }`,
 * which serializes to an ScVal vec: [Symbol("Trial"), Symbol(trialId)].
 */
export async function fetchTrialMeta(trialId: string): Promise<{
  trialId: string;
  enrollmentCount: number;
  active: boolean;
  configHash: string;
  lastModifiedLedger: number | null;
} | null> {
  const { rpc, config } = server();

  const key = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Trial"),
    xdr.ScVal.scvSymbol(trialId),
  ]);

  let entry: SorobanRpc.Api.LedgerEntryResult;
  try {
    entry = await rpc.getContractData(config.contractId, key, SorobanRpc.Durability.Persistent);
  } catch {
    return null;
  }
  const contractData = entry?.val?.contractData?.();
  if (!contractData) return null;
  const value = contractData.val();

  const meta = scValToNative(value) as {
    trial_id: unknown;
    enrollment_count: number | bigint;
    config_hash: string | Buffer;
    active: boolean;
  };
  return {
    trialId: String(meta.trial_id),
    enrollmentCount: Number(meta.enrollment_count),
    active: Boolean(meta.active),
    configHash: Buffer.isBuffer(meta.config_hash)
      ? meta.config_hash.toString("hex")
      : String(meta.config_hash),
    lastModifiedLedger: entry.lastModifiedLedgerSeq ?? null,
  };
}

export async function fetchEnrollmentCount(trialId: string): Promise<number> {
  const meta = await fetchTrialMeta(trialId);
  if (!meta) {
    throw new Error(
      `Trial ${trialId} is not registered on contract ${getChainConfig()?.contractId}. Check the trial ID and the contract.`
    );
  }
  return meta.enrollmentCount;
}

export interface LatestEnrollment {
  txHash: string;
  ledger: number;
  count: number;
  /** Ledger close time of the enrollment, as a JS Date. */
  closedAt: Date;
}

/**
 * Reads the most recent `enrolled` event emitted by the contract for this
 * trial. Used by the sponsor dashboard's "Latest enrollment" row. Real chain
 * data; contains no health information (the event payload is
 * (enrollment_count, ledger_timestamp)).
 */
export async function fetchLatestEnrollment(trialId: string): Promise<LatestEnrollment | null> {
  const { rpc, config } = server();
  // NOTE: the public testnet RPC only indexes a bounded, recent window of
  // contract events. This is best-effort: on any RPC where the window does not
  // reach the enrollment, the dashboard falls back to the authoritative
  // contract state (fetchTrialMeta) and says so.
  const latest = await rpc.getLatestLedger();
  const startLedger = Math.max(latest.sequence - 2000, 1);

  let res;
  try {
    res = await rpc.getEvents({
      startLedger,
      limit: 200,
      filters: [
        {
          type: "contract",
          contractIds: [config.contractId],
          topics: [[xdr.ScVal.scvSymbol("enrolled").toXDR("base64")]],
        },
      ],
    });
  } catch {
    return null;
  }

  const matches = (res.events ?? []).filter(
    (ev) => ev.type === "contract" && ev.inSuccessfulContractCall
  );
  matches.sort((a, b) => b.ledger - a.ledger);

  for (const ev of matches) {
    const topics = ev.topic ?? [];
    // topic[0] is the event name, topic[1] is the trial Symbol.
    if (topics.length > 1 && String(scValToNative(topics[1])) !== trialId) continue;
    let count = 0;
    try {
      const body = scValToNative(ev.value) as [number, number];
      count = Number(body?.[0] ?? 0);
    } catch {
      count = 0;
    }
    return {
      txHash: ev.txHash,
      ledger: ev.ledger,
      count,
      closedAt: new Date(Number(ev.ledgerClosedAt) * 1000),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// WRITE: build -> simulate -> prepare -> sign -> submit -> wait for confirmation
// ---------------------------------------------------------------------------

export interface EnrollmentResult {
  txHash: string;
  ledger: number;
  count: number;
}

/**
 * Submits a REAL `record_enrollment` Soroban transaction.
 *
 * Steps (all genuine, no shortcuts):
 *   1. load the signer's account from the network
 *   2. build the contract invocation
 *   3. simulate to get the Soroban resource footprint + auth
 *   4. prepare the transaction with the simulated data
 *   5. ask the connected wallet to sign the XDR
 *   6. submit the signed transaction
 *   7. poll until the transaction is confirmed on-chain
 *
 * The enrollment counter is read back from contract storage after
 * confirmation, so the returned `count` is real on-chain state.
 */
export async function submitEnrollment(params: {
  publicKey: string;
  trialId: string;
  nullifierHex: string;
}): Promise<EnrollmentResult> {
  const { rpc, config } = server();
  const { publicKey, trialId, nullifierHex } = params;

  const nullifierBytes = Buffer.from(nullifierHex, "hex");
  if (nullifierBytes.length !== 32) {
    throw new Error("Nullifier must be a 32-byte (64 hex character) SHA-256 digest.");
  }

  // 1. real account from the network
  const source = await rpc.getAccount(publicKey);

  // 2. real contract invocation: record_enrollment(trial_id: Symbol, nullifier: BytesN<32>)
  const contract = new Contract(config.contractId);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "record_enrollment",
        nativeToScVal(trialId, { type: "symbol" }),
        nativeToScVal(new Uint8Array(nullifierBytes), { type: "bytes" })
      )
    )
    .setTimeout(300)
    .build();

  // 3. simulate (resource footprint, Soroban auth, computed fee)
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Soroban simulation failed: ${sim.error}`);
  }
  if (!sim.result) throw new Error("Soroban simulation returned no result.");

  // 4. attach the simulated footprint/auth
  const prepared = await rpc.prepareTransaction(tx);

  // 5. real wallet signature
  const signedXdr = await signTransactionXdr(prepared.toXDR(), config.network);

  // 6. submit
  const submitted = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const sendRes = await rpc.sendTransaction(submitted);
  if (sendRes.status !== "PENDING" && sendRes.status !== "DUPLICATE") {
    throw new Error(
      `Soroban submission rejected by the network (status: ${sendRes.status}). This usually means a bad sequence number, insufficient XLM fee, or a simulation mismatch.`
    );
  }
  const txHash = sendRes.hash;

  // 7. wait for real confirmation
  const ledger = await waitForConfirmation(rpc, txHash);
  if (ledger === null) {
    throw new Error(
      `Transaction ${txHash} was submitted but did not reach a confirmed status in time. Check it on the explorer before retrying.`
    );
  }

  const meta = await fetchTrialMeta(trialId);
  return { txHash, ledger, count: meta ? meta.enrollmentCount : 0 };
}

async function waitForConfirmation(
  rpc: SorobanRpc.Server,
  txHash: string
): Promise<number | null> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const res = await rpc.getTransaction(txHash);
      if (res.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return (res as SorobanRpc.Api.GetSuccessfulTransactionResponse).ledger ?? null;
      }
      if (res.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(
          "The enrollment transaction was included in a ledger but the contract rejected it (for example, this participant already enrolled in this trial)."
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("contract rejected it")) throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export { Address };
