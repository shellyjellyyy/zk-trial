import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

/**
 * Midnight network configuration for zk-trial.
 *
 * NETWORK identifiers are plain strings in midnight-js 4.x ("undeployed",
 * "devnet", "testnet", "preprod", "mainnet"). The Midnight.js global network
 * id is registered here once, at module load, so every SDK call in the app
 * (proof generation, transaction balancing, indexing) agrees on the chain.
 */

/** Known Midnight network ids (the type is a plain string in midnight-js 4.x). */
export type MidnightNetworkName =
  | "undeployed"
  | "devnet"
  | "testnet"
  | "preview"
  | "preprod"
  | "mainnet";

/**
 * The network this MVP targets. Overridable via NEXT_PUBLIC_MIDNIGHT_NETWORK
 * for local experiments (e.g. "preview"), defaulting to Midnight Preprod.
 */
export const NETWORK: MidnightNetworkName =
  (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK as MidnightNetworkName) || "preprod";

/**
 * Public indexer endpoints per network (docs.midnight.network ->
 * "Environments and endpoints"). Used as the read-only fallback; when a
 * wallet is connected, its reported endpoints take precedence.
 */
const PUBLIC_INDEXERS: Record<string, { indexerHttpUrl: string; indexerWsUrl: string }> = {
  preview: {
    indexerHttpUrl: "https://indexer.preview.midnight.network/api/v4/graphql",
    indexerWsUrl: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  },
  preprod: {
    indexerHttpUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerWsUrl: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  },
  mainnet: {
    indexerHttpUrl: "https://indexer.mainnet.midnight.network/api/v4/graphql",
    indexerWsUrl: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
  },
};

export const NETWORK_ENDPOINTS = PUBLIC_INDEXERS[NETWORK] ?? PUBLIC_INDEXERS.preprod;

/**
 * Contract address of the deployed zk-trial Compact contract on Preprod.
 *
 * EMPTY by default: production (Vercel) injects the real address via
 * NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS —
 * dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3 — while a
 * fresh local checkout without configuration renders an honest "not deployed
 * yet" state instead of inventing an address. After deploying through 1AM
 * Wallet, the deploy flow writes the real value here (and/or to the env var).
 */
export const DEPLOYED_CONTRACT_ADDRESS = "";

/** Register the global Midnight.js network id exactly once. */
let networkRegistered = false;
export function ensureNetworkRegistered(): MidnightNetworkName {
  if (!networkRegistered) {
    setNetworkId(NETWORK);
    networkRegistered = true;
  }
  return NETWORK;
}

export function networkLabel(): string {
  return `Midnight ${NETWORK.charAt(0).toUpperCase()}${NETWORK.slice(1)}`;
}

/**
 * Base URL the ZK artifacts (prover/verifier keys, zkIR) are fetched from.
 * Defaults to this app's own origin (served from public/zk by
 * scripts/copy-zk-assets.mjs); NEXT_PUBLIC_ZK_ASSETS_BASE_URL points at a
 * CDN instead.
 */
export function zkAssetsBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ZK_ASSETS_BASE_URL?.trim();
  if (fromEnv) return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
  return `${window.location.origin}/zk/`;
}
