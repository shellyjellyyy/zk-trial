"use client";

import { useCallback, useEffect, useState } from "react";
import { TRIALS } from "@zk-trial/lib/trial/trials";
import {
  fetchTrialMeta,
  fetchLatestEnrollment,
  isChainConfigured,
  getChainConfig,
  type LatestEnrollment,
} from "@zk-trial/lib/chain/soroban";

function chainTrialId(trialId: string): string {
  return trialId.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
}

export default function SponsorDashboard() {
  const trial = TRIALS[0];
  const [count, setCount] = useState<number | null>(null);
  const [stateLedger, setStateLedger] = useState<number | null>(null);
  const [latest, setLatest] = useState<LatestEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const configured = isChainConfigured();
  const config = getChainConfig();

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      const id = chainTrialId(trial.trialId);
      const [meta, l] = await Promise.all([
        fetchTrialMeta(id),
        fetchLatestEnrollment(id).catch(() => null),
      ]);
      if (!meta) {
        throw new Error(
          `Trial ${id} has no state entry on contract ${config!.contractId} (${config!.networkLabel}).`
        );
      }
      setCount(meta.enrollmentCount);
      setStateLedger(meta.lastModifiedLedger);
      setLatest(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [configured, config, trial.trialId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const explorer = process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL || "https://stellar.expert/explorer/testnet";

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-2xl font-semibold">Sponsor Dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">
        Aggregate, anonymous enrollment activity read live from Soroban contract storage. It never
        receives participant health values, names, or raw medical JSON.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="glass-card p-8">
          <p className="text-xs uppercase tracking-wide text-slate-500">Verified enrollments</p>
          <p className="mt-2 text-5xl font-semibold text-white">
            {configured ? (loading && count === null ? "…" : (count ?? "—")) : "—"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Trial: {trial.title} ({trial.trialId})
          </p>
          <p className="mt-1 text-xs text-slate-500">Status: {trial.status}</p>
        </div>

        <div className="glass-card space-y-3 p-8 text-sm">
          <Row label="Network" value={configured ? config!.networkLabel : "Not configured"} />
          <Row
            label="Contract"
            value={configured ? config!.contractId : "Deploy with scripts/deploy-preprod.sh"}
            mono
          />
          <Row label="RPC" value={configured ? config!.rpcUrl : "—"} />
          <Row label="Last updated" value={lastUpdated ? lastUpdated.toLocaleTimeString() : "—"} />
        </div>
      </div>

      <div className="mt-6 glass-card p-8">
        <h2 className="text-sm font-medium text-slate-200">Latest enrollment</h2>
        {latest ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-400">
              Enrollment #{latest.count} confirmed in ledger {latest.ledger}.
            </p>
            <a
              className="block break-all font-mono text-xs text-accent-glow underline"
              href={`${explorer}/tx/${latest.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {latest.txHash}
            </a>
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <p>
              {configured
                ? "The public testnet RPC only indexes a bounded window of contract events, so the last enrolled transaction cannot always be shown here."
                : "Not available — no contract configured."}
            </p>
            {configured && stateLedger !== null && (
              <p>
                Authoritative contract state was last modified in ledger{" "}
                <span className="text-slate-300">{stateLedger}</span>.
              </p>
            )}
          </div>
        )}
      </div>

      {!configured && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No Soroban contract is configured yet. This dashboard shows nothing rather than mocked
          numbers — it reads live state from the deployed contract.
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button onClick={refresh} className="btn-secondary" disabled={!configured || loading}>
          {loading ? "Refreshing…" : "Refresh now"}
        </button>
        {configured && (
          <a
            className="text-sm text-accent-glow underline"
            href={`${explorer}/contract/${config!.contractId}`}
            target="_blank"
            rel="noreferrer"
          >
            Open contract on explorer
          </a>
        )}
      </div>

      <div className="mt-10 rounded-lg border border-white/10 bg-black/20 p-6 text-xs text-slate-400">
        <p className="font-medium text-slate-300">What the sponsor can and cannot see</p>
        <p className="mt-2">
          Visible: trial ID, an aggregate enrollment counter, a trial-scoped anonymous nullifier,
          and ledger timestamps. Not visible: age, biomarker level, medication status, pregnancy
          status, condition status, or any raw medical JSON. Eligibility is established by a
          zero-knowledge proof generated and verified in the participant&apos;s browser; Soroban
          provides the immutable anonymous enrollment and audit layer.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`max-w-[60%] truncate text-right text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
