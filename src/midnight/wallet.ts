import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import { ensureNetworkRegistered, NETWORK } from "./config";

/**
 * 1AM Wallet integration.
 *
 * 1AM Wallet (the Midnight browser wallet) implements version 4 of the
 * Midnight DApp Connector API and injects its `InitialAPI` under
 * `window.midnight`. Per that API, a wallet entry carries a reverse-DNS
 * identifier, a display name, an icon URL, the implemented API version, and a
 * `connect(networkId)` method. This module discovers the injected wallet,
 * connects it to Midnight Preprod, and exposes the `ConnectedAPI` the provider
 * stack needs (balancing, proving, submission, addresses, service config).
 *
 * There is no fake wallet here: if 1AM Wallet is not installed the UI shows
 * the install/unlock instructions instead of pretending to be connected.
 */

/** Reverse-DNS identifiers 1AM Wallet has been observed to inject. */
const ONEMAM_RDNS = ["xyz.1am.wallet", "com.oneam.wallet", "wallet.1am.xyz"];

/**
 * Canonical injection key used by 1AM Wallet (docs: window.midnight['1am']).
 * The DApp Connector API also keys entries by UUID in other builds, so
 * detection falls back to rdns/name matching below.
 */
const ONEMAM_INJECTION_KEY = "1am";

export type DetectedWallet = {
  /** Key under window.midnight this wallet was found at. */
  readonly injectionKey: string;
  /** Reverse-DNS identifier reported by the wallet. */
  readonly rdns: string;
  /** Display name reported by the wallet (sanitize before rendering). */
  readonly name: string;
  /** Wallet icon URL (render via <img src> only; never as markup). */
  readonly icon: string;
  /** DApp Connector API version implemented by the wallet. */
  readonly apiVersion: string;
  /** The injected InitialAPI. */
  readonly api: InitialAPI;
};

export class WalletUnavailableError extends Error {
  constructor() {
    super(
      "1AM Wallet not detected. Install/unlock 1AM Wallet and reload this page.",
    );
    this.name = "WalletUnavailableError";
  }
}

export class WalletNetworkMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(
      `1AM Wallet is connected to "${actual}" but zk-trial targets "${expected}". Switch the wallet's network and reconnect.`,
    );
    this.name = "WalletNetworkMismatchError";
  }
}

function asInitialAPI(value: unknown): InitialAPI | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<InitialAPI>;
  if (typeof v.connect !== "function") return null;
  return {
    rdns: typeof v.rdns === "string" ? v.rdns : "",
    name: typeof v.name === "string" ? v.name : "",
    icon: typeof v.icon === "string" ? v.icon : "",
    apiVersion: typeof v.apiVersion === "string" ? v.apiVersion : "",
    connect: v.connect,
  };
}

/**
 * Enumerate every DApp Connector wallet injected on window.midnight.
 * Returns entries keyed by their injection key so the UI can prefer 1AM.
 */
export function listInjectedWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  const root = (
    window as unknown as { midnight?: Record<string, unknown> }
  ).midnight;
  if (!root || typeof root !== "object") return [];

  const wallets: DetectedWallet[] = [];
  for (const [key, value] of Object.entries(root)) {
    const api = asInitialAPI(value);
    if (!api) continue;
    wallets.push({
      injectionKey: key,
      rdns: api.rdns,
      name: api.name || key,
      icon: api.icon,
      apiVersion: api.apiVersion,
      api,
    });
  }
  return wallets;
}

/** True if a wallet with a 1AM identifier (or the canonical "1AM" name) is injected. */
export function is1AMWalletAvailable(): boolean {
  return listInjectedWallets().some(is1AMWallet);
}

function is1AMWallet(w: DetectedWallet): boolean {
  if ((w.injectionKey || "").toLowerCase() === ONEMAM_INJECTION_KEY) return true;
  const rdns = (w.rdns || "").toLowerCase();
  if (ONEMAM_RDNS.includes(rdns)) return true;
  if (rdns.includes("1am")) return true;
  // Fall back to the display name for wallet builds that ship an unusual rdns.
  return w.name.toLowerCase().includes("1am");
}

/** The injected 1AM Wallet, if present. */
export function detect1AMWallet(): DetectedWallet | null {
  return listInjectedWallets().find(is1AMWallet) ?? null;
}

/** Any DApp Connector wallet (used to show a helpful "unknown wallet" message). */
export function detectAnyWallet(): DetectedWallet | null {
  return listInjectedWallets()[0] ?? null;
}

export type OneAMConnection = {
  /** The connected DApp Connector API (balancing / proving / submission). */
  readonly api: ConnectedAPI;
  /** Network id reported by the wallet's service configuration. */
  readonly networkId: string;
  /** Shielded (zswap) address of the connected account. */
  readonly shieldedAddress: string;
  /** Coin public key (Bech32m) used for circuit calls. */
  readonly coinPublicKey: string;
  /** Encryption public key (Bech32m) used for coin outputs. */
  readonly encryptionPublicKey: string;
  /** Transparent address of the connected account. */
  readonly unshieldedAddress: string;
  /** Wallet-configured service endpoints (indexer etc.). */
  readonly indexerHttpUrl: string;
  readonly indexerWsUrl: string;
  /** Wallet-configured HTTP proof server (e.g. ProofStation), when present. */
  readonly proverServerUri: string | undefined;
};

/**
 * Connect 1AM Wallet to Midnight Preprod via the DApp Connector API.
 *
 * The wallet itself decides how to authorize the connection (its own prompt).
 * After connecting, the wallet-reported network id is checked against the
 * network zk-trial targets so a mainnet/testnet wallet cannot submit a Preprod
 * transaction silently.
 */
export async function connect1AMWallet(): Promise<OneAMConnection> {
  ensureNetworkRegistered();

  const wallet = detect1AMWallet();
  if (!wallet) throw new WalletUnavailableError();

  const connectedApi: ConnectedAPI = await wallet.api.connect(NETWORK);

  const [config, shielded, unshielded] = await Promise.all([
    connectedApi.getConfiguration(),
    connectedApi.getShieldedAddresses(),
    connectedApi.getUnshieldedAddress(),
  ]);

  if (config.networkId && config.networkId !== NETWORK) {
    throw new WalletNetworkMismatchError(NETWORK, config.networkId);
  }

  return {
    api: connectedApi,
    networkId: config.networkId || NETWORK,
    shieldedAddress: shielded.shieldedAddress,
    coinPublicKey: shielded.shieldedCoinPublicKey,
    encryptionPublicKey: shielded.shieldedEncryptionPublicKey,
    unshieldedAddress: unshielded.unshieldedAddress,
    indexerHttpUrl: config.indexerUri,
    indexerWsUrl: config.indexerWsUri,
    proverServerUri: config.proverServerUri,
  };
}
