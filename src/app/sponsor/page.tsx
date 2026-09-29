"use client";

import { useCallback, useEffect, useState } from "react";
import { TRIALS } from "@/lib/trial";
import { NETWORK_ENDPOINTS, networkLabel } from "../../midnight/config";
import { isContractDeployed, resolveContractAddress } from "../../utils/contract";
import type { ZkTrialProviders } from "../../midnight/providers";
import { fetchEnrollmentCount } from "../../midnight/contract-api";
import ContractDeploy from "@/components/ContractDeploy";

export default function SponsorDashboard() {
  const trial = TRIALS[0];
  const [count, setCount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [deployed, setDeployed] = useState(false);

  // Re-check after a browser-side deploy (localStorage write) so the
  // dashboard immediately switches to live reads.
  useEffect(() => {
    setDeployed(isContractDeployed());
  }, []);

  // The dashboard reads public chain state only. It uses a provider set built
  // around the public Preprod indexer and does NOT require the wallet.
  const refresh = useCallback(async () => {
    if (!deployed) return;
    setLoading(true);
    try {
      const { createProvidersFromWalletless } = await import(
        "../../midnight/providerless"
      );
      const providers = await createProvidersFromWalletless();
      const c = await fetchEnrollmentCount(providers, resolveContractAddress());
      if (c === null) {
        throw new Error(
          `No contract state found at ${resolveContractAddress()} on ${networkLabel()}.`,
        );
      }
      setCount(c.toString());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [deployed]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-2xl font-semibold">Sponsor Dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">
        Aggregate, anonymous enrollment activity read live from the zk-trial
        contract on Midnight Preprod. It never includes participant health
        values, identities, or raw medical data.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="glass-card p-8">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Verified enrollments
          </p>
          <p className="mt-2 text-5xl font-semibold text-white">
            {deployed ? (loading && count === null ? "…" : (count ?? "—")) : "—"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Trial: {trial.title} ({trial.trialId})
          </p>
          <p className="mt-1 text-xs text-slate-500">Status: {trial.status}</p>
        </div>

        <div className="glass-card space-y-3 p-8 text-sm">
          <Row label="Network" value={networkLabel()} />
          <Row
            label="Contract"
            value={deployed ? resolveContractAddress() : "Not deployed yet"}
            mono
          />
          <Row label="Indexer" value={NETWORK_ENDPOINTS.indexerHttpUrl} mono />
          <Row
            label="Last updated"
            value={lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
          />
        </div>
      </div>

      {!deployed && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          The zk-trial Compact contract has not been deployed to Midnight
          Preprod yet, so there is no real counter to display. This dashboard
          shows nothing rather than a mocked number.
        </div>
      )}

      {!deployed && <ContractDeploy onDeployed={() => setDeployed(true)} />}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={() => void refresh()}
          className="btn-secondary"
          disabled={!deployed || loading}
        >
          {loading ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      <div className="mt-10 rounded-lg border border-white/10 bg-black/20 p-6 text-xs text-slate-400">
        <p className="font-medium text-slate-300">
          What the sponsor can and cannot see
        </p>
        <p className="mt-2">
          Visible on Midnight Preprod: the trial ID, the sponsor name, a
          trial-scoped anonymous nullifier set, and the enrollment counter. Not
          visible anywhere: age, biomarker level, medication status, country,
          pregnancy status, condition status, or any raw medical data.
          Eligibility is established inside the Compact zero-knowledge circuit
          executed by the participant&apos;s own browser and wallet.
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

// Keep the type import referenced for consumers that pass a provider set in.
export type { ZkTrialProviders };
