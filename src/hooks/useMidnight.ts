"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProvidersFromWallet,
  connect1AMWallet,
  detect1AMWallet,
  detectAnyWallet,
  ensureNetworkRegistered,
  makeFetchZkConfigProvider,
  zkAssetsBaseUrl,
  WalletUnavailableError,
  type OneAMConnection,
  type ZkTrialProviders,
} from "../midnight";

export type WalletStatus =
  | "checking"
  | "unavailable"
  | "available"
  | "connecting"
  | "connected"
  | "error";

export type UseMidnightResult = {
  status: WalletStatus;
  connection: OneAMConnection | null;
  providers: ZkTrialProviders | null;
  error: string | null;
  otherWalletDetected: boolean;
  connect: () => Promise<void>;
  recheck: () => void;
};

/**
 * React binding for the 1AM Wallet + Midnight.js provider stack.
 *
 * Detection runs client-side only (wallets inject into window.midnight).
 * `connect` performs the DApp Connector handshake against Midnight Preprod,
 * then assembles the full MidnightProviders set (wallet prover preferred,
 * Preprod proof server fallback, Preprod indexer for public data).
 */
export function useMidnight(): UseMidnightResult {
  const [status, setStatus] = useState<WalletStatus>("checking");
  const [connection, setConnection] = useState<OneAMConnection | null>(null);
  const [providers, setProviders] = useState<ZkTrialProviders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherWalletDetected, setOtherWalletDetected] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const recheck = useCallback(() => {
    if (statusRef.current === "connected") return;
    const has1AM = detect1AMWallet() !== null;
    const hasAny = detectAnyWallet() !== null;
    setOtherWalletDetected(hasAny && !has1AM);
    setStatus((s) =>
      s === "checking" ? (has1AM ? "available" : "unavailable") : s,
    );
  }, []);

  useEffect(() => {
    recheck();
    // Wallet extensions may inject after first paint.
    const t1 = window.setTimeout(recheck, 400);
    const t2 = window.setTimeout(recheck, 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [recheck]);

  const connect = useCallback(async () => {
    setError(null);
    if (detect1AMWallet() === null) {
      setStatus("unavailable");
      throw new WalletUnavailableError();
    }
    setStatus("connecting");
    try {
      ensureNetworkRegistered();
      const conn = await connect1AMWallet();
      // ZK artifacts are served from /zk/{keys,zkir}/... (copied at build time
      // from managed/zk-trial by scripts/copy-zk-assets.mjs).
      const zkConfig = makeFetchZkConfigProvider(zkAssetsBaseUrl());
      const provs = await createProvidersFromWallet(conn, zkConfig);
      setConnection(conn);
      setProviders(provs);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      throw e;
    }
  }, []);

  return {
    status,
    connection,
    providers,
    error,
    otherWalletDetected,
    connect,
    recheck,
  };
}
