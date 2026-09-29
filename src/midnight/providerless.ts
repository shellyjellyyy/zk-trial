import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { inMemoryPrivateStateProvider } from "./providers";
import {
  ZKConfigProvider,
  type PrivateStateProvider,
  type ProofProvider,
  type WalletProvider,
  type MidnightProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { NETWORK_ENDPOINTS, ensureNetworkRegistered } from "./config";
import type { ZkTrialCircuitId, ZkTrialProviders } from "./providers";

/**
 * A wallet-less provider set for read-only public data (sponsor dashboard).
 *
 * Only publicDataProvider is meaningfully used here: private state is an
 * in-memory no-op and no proof/wallet/submit provider is required to READ
 * contract state. This keeps the sponsor dashboard free of any wallet
 * dependency — it aggregates anonymous counts, nothing else.
 *
 * Note: ProofProvider/WalletProvider/MidnightProvider slots are mandatory in
 * the MidnightProviders type, so explicit throwing stubs make any accidental
 * write attempt fail loudly instead of silently misbehaving.
 */
export async function createProvidersFromWalletless(): Promise<ZkTrialProviders> {
  ensureNetworkRegistered();

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(
      NETWORK_ENDPOINTS.indexerHttpUrl,
      NETWORK_ENDPOINTS.indexerWsUrl,
    ),
    zkConfigProvider: new (class extends ZKConfigProvider<ZkTrialCircuitId> {
      async getZKIR(): Promise<never> {
        throw new Error("zkConfigProvider is not available in read-only mode.");
      }
      async getProverKey(): Promise<never> {
        throw new Error("zkConfigProvider is not available in read-only mode.");
      }
      async getVerifierKey(): Promise<never> {
        throw new Error("zkConfigProvider is not available in read-only mode.");
      }
    })(),
    proofProvider: {
      async proveTx() {
        throw new Error("Proof generation is not available in read-only mode.");
      },
    },
    walletProvider: {
      getCoinPublicKey() {
        throw new Error("No wallet is connected in read-only mode.");
      },
      getEncryptionPublicKey() {
        throw new Error("No wallet is connected in read-only mode.");
      },
      async balanceTx() {
        throw new Error("Transaction balancing is not available in read-only mode.");
      },
    },
    midnightProvider: {
      async submitTx() {
        throw new Error("Transaction submission is not available in read-only mode.");
      },
    },
  };
}
