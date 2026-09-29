"use client";

import { useMidnight } from "../hooks/useMidnight";

function short(address: string): string {
  return address.length > 21
    ? `${address.slice(0, 11)}…${address.slice(-6)}`
    : address;
}

/**
 * "Connect 1AM Wallet" button + connection status card.
 *
 * Shows honest states only: not-installed guidance, connecting, connected
 * (with the shielded address), or the real error returned by the wallet.
 */
export default function WalletConnect() {
  const { status, connection, error, otherWalletDetected, connect } =
    useMidnight();

  return (
    <div className="glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Wallet
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-200">
            {status === "checking" && "Detecting 1AM Wallet…"}
            {status === "unavailable" && "1AM Wallet not detected"}
            {status === "available" && "1AM Wallet detected"}
            {status === "connecting" && "Connecting 1AM Wallet…"}
            {status === "connected" && "1AM Wallet connected"}
            {status === "error" && "Connection failed"}
          </p>
          {status === "connected" && connection && (
            <p className="mt-1 break-all font-mono text-xs text-slate-400">
              {short(connection.shieldedAddress)} · Midnight Preprod
            </p>
          )}
        </div>

        {status !== "connected" ? (
          <button
            onClick={() => void connect()}
            disabled={status === "checking" || status === "connecting"}
            className="btn-primary"
          >
            {status === "connecting" ? "Connecting…" : "Connect 1AM Wallet"}
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        )}
      </div>

      {status === "unavailable" && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          1AM Wallet not detected. Install/unlock 1AM Wallet and reload this
          page.
        </p>
      )}
      {status === "unavailable" && otherWalletDetected && (
        <p className="mt-2 text-xs text-slate-500">
          A different Midnight DApp Connector wallet was detected, but zk-trial
          is integrated with 1AM Wallet.
        </p>
      )}
      {status === "error" && error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
