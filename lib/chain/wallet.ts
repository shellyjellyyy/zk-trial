// lib/chain/wallet.ts
//
// Minimal, dependency-free browser wallet connector for Stellar, built on the
// Freighter extension API (window.freighter). Freighter is the reference
// Stellar browser wallet; we deliberately do not add a wrapper package so the
// integration is auditable and small.
//
// NOTHING in this module ever touches private health values. It only ever
// deals with: a public key, a network name, and a transaction XDR string.

export type FreighterNetwork = "PUBLIC" | "TESTNET" | "FUTURENET";

interface FreighterSignResult {
  signedTransaction?: string;
  error?: string;
}

interface FreighterApi {
  getPublicKey?: () => Promise<{ publicKey?: string; error?: string }>;
  connect?: () => Promise<{ currentNetwork?: string; error?: string }>;
  signTransaction?: (
    xdr: string,
    opts?: Record<string, unknown> | string
  ) => Promise<FreighterSignResult>;
  isConnected?: () => Promise<boolean>;
}

function freighter(): FreighterApi | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { freighter?: FreighterApi };
  return w.freighter ?? null;
}

export function isWalletAvailable(): boolean {
  const f = freighter();
  return !!(f && typeof f.getPublicKey === "function");
}

export class WalletUnavailableError extends Error {
  constructor() {
    super(
      "Connect your Stellar wallet to enroll. Install the Freighter browser extension, then unlock it and click Connect."
    );
    this.name = "WalletUnavailableError";
  }
}

export class WalletRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletRejectedError";
  }
}

/** Best-effort detection of the network the wallet is currently on. */
export async function detectWalletNetwork(): Promise<FreighterNetwork | null> {
  const f = freighter();
  if (!f || typeof f.connect !== "function") return null;
  try {
    const res = await f.connect();
    const raw = String(res?.currentNetwork ?? "").toUpperCase();
    if (raw === "PUBLIC" || raw === "MAINNET") return "PUBLIC";
    if (raw === "TESTNET") return "TESTNET";
    if (raw === "FUTURENET") return "FUTURENET";
    return null;
  } catch {
    return null;
  }
}

/** Prompts the wallet for its public key (this is the real "Connect" step). */
export async function connectWallet(): Promise<string> {
  const f = freighter();
  if (!f || typeof f.getPublicKey !== "function") throw new WalletUnavailableError();
  let res: { publicKey?: string; error?: string };
  try {
    res = await f.getPublicKey();
  } catch (e) {
    throw new WalletRejectedError(e instanceof Error ? e.message : String(e));
  }
  if (res?.error) throw new WalletRejectedError(res.error);
  if (!res?.publicKey) throw new WalletRejectedError("Wallet did not return a public key.");
  return res.publicKey;
}

/**
 * Asks the wallet to sign a transaction XDR. Tries the current Freighter
 * options-object signature first and falls back to the older
 * signTransaction(xdr, network) signature so this works across Freighter
 * versions. Throws WalletRejectedError if the user declines or the wallet
 * reports an error -- we never fabricate a signature.
 */
export async function signTransactionXdr(
  xdr: string,
  network: FreighterNetwork
): Promise<string> {
  const f = freighter();
  if (!f || typeof f.signTransaction !== "function") throw new WalletUnavailableError();

  const attempts: Array<Record<string, unknown> | string> = [{ network }, network];
  let lastError = "";
  for (const opts of attempts) {
    let res: FreighterSignResult;
    try {
      res = await f.signTransaction(xdr, opts);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
    if (res?.error) {
      lastError = res.error;
      continue;
    }
    if (res?.signedTransaction) return res.signedTransaction;
    lastError = lastError || "Wallet returned no signed transaction.";
  }
  throw new WalletRejectedError(
    lastError || "Signature was not returned by the wallet (request rejected)."
  );
}
