"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TrialConfig } from "@zk-trial/lib/trial/trials";
import { trialToCircuitPublicSignals } from "@zk-trial/lib/trial/trials";
import {
  generateEligibilityProof,
  verifyEligibilityProof,
  EligibilityNotSatisfiedError,
  type PrivateHealthInputs,
} from "@zk-trial/lib/zk/proof";
import { getOrCreateParticipantSecret, deriveNullifier } from "@zk-trial/lib/privacy/nullifier";
import {
  isChainConfigured,
  getChainConfig,
  submitEnrollment,
  type EnrollmentResult,
} from "@zk-trial/lib/chain/soroban";
import {
  isWalletAvailable,
  detectWalletNetwork,
  connectWallet,
  WalletUnavailableError,
  WalletRejectedError,
} from "@zk-trial/lib/chain/wallet";

type Stage =
  | "form"
  | "proving"
  | "verifying"
  | "proof_ready"
  | "enrolling"
  | "confirmed"
  | "ineligible"
  | "error";

const STAGE_ORDER: Stage[] = ["proving", "verifying", "enrolling", "confirmed"];

const STAGE_LABEL: Record<string, string> = {
  proving: "Generating ZK proof",
  verifying: "Verifying ZK proof",
  enrolling: "Submitting blockchain transaction",
  confirmed: "Enrollment confirmed on-chain",
};

export default function EligibilityFlow({ trial }: { trial: TrialConfig }) {
  const [stage, setStage] = useState<Stage>("form");
  const [form, setForm] = useState({
    age: 32,
    biomarker: 61,
    medicationX: true,
    country: "IN",
    pregnant: false,
    conditionY: false,
  });
  const [errorMessage, setErrorMessage] =useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [lastNetworkPayload, setLastNetworkPayload] = useState<Record<string, unknown> | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollmentResult | null>(null);
  const [connecting, setConnecting] = useState(false);

  const chainConfigured = isChainConfigured();
  const chainConfig = getChainConfig();
  const walletAvailable = isWalletAvailable();

  useEffect(() => {
    detectWalletNetwork().then((n) => setWalletNetwork(n ?? null));
  }, []);

  // ------------------------------------------------------------------------
  // Step A: ZK proof (fully client-side, no network involvement)
  // ------------------------------------------------------------------------
  async function handleProve(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStage("proving");

    // Private values live only in this component's state and in the circuit
    // inputs. They are never fetch()'d, logged, or placed in a URL.
    const privateInputs: PrivateHealthInputs = {
      age: form.age,
      biomarker: form.biomarker,
      medicationX: form.medicationX,
      // The participant's ACTUAL country, as an ISO-3166-1 numeric code. This is a
      // private input to the circuit: picking a country the trial does not
      // recruit in makes the proof impossible to generate, which is the point.
      countryCode: ISO_NUMERIC[form.country] ?? 0,
      pregnant: form.pregnant,
      conditionY: form.conditionY,
      salt: Math.floor(Math.random() * 1_000_000_000),
    };
    const publicSignals = trialToCircuitPublicSignals(trial);

    try {
      const { proof, publicSignals: outSignals } = await generateEligibilityProof(
        privateInputs,
        publicSignals
      );

      setStage("verifying");
      const ok = await verifyEligibilityProof(proof, outSignals);
      if (!ok) throw new Error("Local Groth16 verification of the generated proof failed.");

      const secret = getOrCreateParticipantSecret();
      const nf = await deriveNullifier(secret, trial.trialId);
      setNullifier(nf);
      setLastNetworkPayload({
        trialId: trial.trialId,
        nullifier: nf,
        proofVerifiedLocally: true,
      });
      setStage("proof_ready");
    } catch (err) {
      if (err instanceof EligibilityNotSatisfiedError) {
        setStage("ineligible");
      } else {
        // Safe: `err` never contains private health values.
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStage("error");
      }
    }
  }

  // ------------------------------------------------------------------------
  // Step B: wallet connect
  // ------------------------------------------------------------------------
  async function handleConnect() {
    setConnecting(true);
    setErrorMessage(null);
    try {
      const pk = await connectWallet();
      setPublicKey(pk);
      setWalletNetwork((await detectWalletNetwork()) ?? null);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  // ------------------------------------------------------------------------
  // Step C: real on-chain enrollment
  // ------------------------------------------------------------------------
  async function handleEnroll() {
    if (!publicKey || !nullifier) return;
    setErrorMessage(null);
    setStage("enrolling");
    try {
      const res = await submitEnrollment({
        publicKey,
        trialId: chainTrialId(trial.trialId),
        nullifierHex: nullifier,
      });
      setResult(res);
      setTxHash(res.txHash);
      setStage("confirmed");
    } catch (e) {
      // Honest failure: never claim enrollment succeeded without a real,
      // confirmed on-chain transaction.
      setResult(null);
      setTxHash(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStage("proof_ready");
    }
  }

  // ------------------------------------------------------------------------

  if (stage === "confirmed" && result) {
    return (
      <ResultConfirmed
        trial={trial}
        nullifier={nullifier}
        result={result}
        networkPayload={lastNetworkPayload}
        onReset={() => {
          setStage("form");
          setResult(null);
          setTxHash(null);
        }}
      />
    );
  }

  if (stage === "ineligible") {
    return <ResultIneligible trial={trial} onReset={() => setStage("form")} />;
  }

  if (stage === "proving" || stage === "verifying" || stage === "enrolling") {
    return <Progress stage={stage} />;
  }

  if (stage === "proof_ready" || (stage === "error" && nullifier)) {
    return (
      <EnrollStep
        trial={trial}
        nullifier={nullifier}
        publicKey={publicKey}
        walletNetwork={walletNetwork}
        walletAvailable={walletAvailable}
        chainConfigured={chainConfigured}
        chainConfig={chainConfig}
        connecting={connecting}
        errorMessage={errorMessage}
        onConnect={handleConnect}
        onEnroll={handleEnroll}
        onReset={() => {
          setStage("form");
          setNullifier(null);
          setErrorMessage(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={handleProve} className="glass-card space-y-5 p-8">
      <div>
        <h2 className="text-lg font-semibold">Check your eligibility</h2>
        <p className="mt-1 text-sm text-accent-glow">
          These values are processed locally in your browser and are never submitted to the
          sponsor.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Age</label>
          <input
            type="number"
            className="field-input"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
            min={0}
            max={120}
          />
        </div>
        <div>
          <label className="field-label">Biomarker A</label>
          <input
            type="number"
            className="field-input"
            value={form.biomarker}
            onChange={(e) => setForm({ ...form, biomarker: Number(e.target.value) })}
            min={0}
            max={200}
          />
        </div>
        <div>
          <label className="field-label">Country</label>
          <select
            className="field-input"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          >
            <option value="IN">India (IN)</option>
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <input
            id="medicationX"
            type="checkbox"
            checked={form.medicationX}
            onChange={(e) => setForm({ ...form, medicationX: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-black/30 accent-accent-purple"
          />
          <label htmlFor="medicationX" className="text-sm text-slate-300">
            Currently taking Medication X
          </label>
        </div>
        <div className="flex items-end gap-2">
          <input
            id="pregnant"
            type="checkbox"
            checked={form.pregnant}
            onChange={(e) => setForm({ ...form, pregnant: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-black/30 accent-accent-purple"
          />
          <label htmlFor="pregnant" className="text-sm text-slate-300">
            Currently pregnant
          </label>
        </div>
        <div className="flex items-end gap-2">
          <input
            id="conditionY"
            type="checkbox"
            checked={form.conditionY}
            onChange={(e) => setForm({ ...form, conditionY: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-black/30 accent-accent-purple"
          />
          <label htmlFor="conditionY" className="text-sm text-slate-300">
            Diagnosed with Condition Y
          </label>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Demo data only. Do not enter real personal health information.
      </p>

      <button type="submit" className="btn-primary w-full">
        Generate my eligibility proof
      </button>
    </form>
  );
}

/** Soroban `Symbol` trial ids are alphanumeric and <= 32 chars: "TRIAL-001" -> "TRIAL001". */
function chainTrialId(trialId: string): string {
  return trialId.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
}

/** ISO-3166-1 numeric codes, which is how the circuit represents a country. */
const ISO_NUMERIC: Record<string, number> = {
  IN: 356,
  US: 840,
  GB: 826,
};

// ---------------------------------------------------------------------------

function Progress({ stage }: { stage: Stage }) {
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return (
    <div className="glass-card p-8">
      <h2 className="mb-6 text-lg font-semibold">{STAGE_LABEL[stage]}…</h2>
      <ul className="space-y-3">
        {STAGE_ORDER.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                i < currentIndex
                  ? "bg-emerald-500/20 text-emerald-300"
                  : i === currentIndex
                  ? "animate-pulse bg-accent-purple/30 text-accent-glow"
                  : "bg-white/5 text-slate-600"
              }`}
            >
              {i < currentIndex ? "✓" : i + 1}
            </span>
            <span className={i <= currentIndex ? "text-slate-200" : "text-slate-600"}>
              {STAGE_LABEL[s]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-500">
        Proof generation runs entirely in your browser via WebAssembly. Your private health values
        never leave this tab.
      </p>
    </div>
  );
}

function EnrollStep({
  trial,
  nullifier,
  publicKey,
  walletNetwork,
  walletAvailable,
  chainConfigured,
  chainConfig,
  connecting,
  errorMessage,
  onConnect,
  onEnroll,
  onReset,
}: {
  trial: TrialConfig;
  nullifier: string | null;
  publicKey: string | null;
  walletNetwork: string | null;
  walletAvailable: boolean;
  chainConfigured: boolean;
  chainConfig: ReturnType<typeof getChainConfig>;
  connecting: boolean;
  errorMessage: string | null;
  onConnect: () => void;
  onEnroll: () => void;
  onReset: () => void;
}) {
  return (
    <div className="glass-card space-y-5 p-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Eligibility proven (Groth16, verified locally)
        </span>
        <h2 className="mt-3 text-xl font-semibold">You qualify for {trial.title}</h2>
        <p className="mt-2 text-sm text-slate-400">
          Your proof was generated and verified in this browser. Now record an anonymous enrollment
          on-chain so the sponsor can see the count — without learning who you are or any health
          value.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Trial" value={trial.trialId} />
        <Field label="Anonymous participant ID" value={nullifier ? `${nullifier.slice(0, 16)}…` : "—"} />
        <Field label="Network" value={chainConfig?.networkLabel ?? "Not configured"} />
        <Field label="Contract" value={chainConfig ? shortId(chainConfig.contractId) : "Not configured"} />
        <Field label="Connected wallet" value={publicKey ? shortId(publicKey) : "Not connected"} />
        <Field label="Wallet network" value={walletNetwork ?? "Unknown"} />
      </dl>

      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p className="font-medium">Blockchain enrollment failed</p>
          <p className="mt-1 break-words">{errorMessage}</p>
        </div>
      )}

      {!chainConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No Soroban contract is configured in this build, so a real transaction cannot be
          submitted. Your proof is still valid and was verified locally.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!publicKey ? (
          <button onClick={onConnect} disabled={connecting} className="btn-primary">
            {connecting ? "Connecting…" : "Connect Stellar wallet"}
          </button>
        ) : (
          <button
            onClick={onEnroll}
            disabled={!chainConfigured || !walletAvailable}
            className="btn-primary"
          >
            {"Enroll on-chain"}
          </button>
        )}
        <button onClick={onReset} className="btn-secondary">
          Start over
        </button>
      </div>

      {!walletAvailable && (
        <p className="text-xs text-slate-500">
          No Stellar browser wallet detected. Install and unlock Freighter, then reload this page.
        </p>
      )}

      <details className="rounded-lg border border-white/10 bg-black/30 p-4 text-xs text-slate-400">
        <summary className="cursor-pointer select-none text-slate-300">
          Developer / debug: exact payload sent to the Soroban contract
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(
            {
              function: "record_enrollment",
              args: {
                trial_id: chainTrialId(trial.trialId),
                nullifier: nullifier ?? null,
              },
            },
            null,
            2
          )}
        </pre>
        <p className="mt-2">
          These two arguments are the entire on-chain footprint. No age, biomarker, medication,
          pregnancy, condition value, or raw medical JSON is ever sent or stored.
        </p>
      </details>
    </div>
  );
}

function ResultConfirmed({
  trial,
  nullifier,
  result,
  networkPayload,
  onReset,
}: {
  trial: TrialConfig;
  nullifier: string | null;
  result: EnrollmentResult;
  networkPayload: Record<string, unknown> | null;
  onReset: () => void;
}) {
  const explorer = process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL || "https://stellar.expert/explorer/testnet";
  return (
    <div className="glass-card p-8">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        Enrollment confirmed on-chain
      </div>
      <h2 className="mt-3 text-xl font-semibold">You qualify for {trial.title}</h2>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <Field label="Trial" value={trial.trialId} />
        <Field label="Proof verified" value="Yes (Groth16, local verification)" />
        <Field label="Enrollment recorded" value="Yes — confirmed by Soroban" />
        <Field label="Anonymous participant ID" value={nullifier ? `${nullifier.slice(0, 16)}…` : "—"} />
        <Field
          label="Transaction hash"
          value={result.txHash}
          mono
        />
        <Field label="On-chain enrollment count" value={String(result.count)} />
        <Field label="Ledger" value={String(result.ledger)} />
        <Field label="Explorer" value="Open transaction →" mono />
      </dl>

      <a
        className="mt-2 inline-block break-all text-sm text-accent-glow underline"
        href={`${explorer}/tx/${result.txHash}`}
        target="_blank"
        rel="noreferrer"
      >
        {result.txHash}
      </a>

      <div className="mt-6 flex gap-3">
        <Link href="/sponsor" className="btn-primary">
          Open sponsor dashboard
        </Link>
        <button onClick={onReset} className="btn-secondary">
          Check another profile
        </button>
      </div>

      <details className="mt-6 rounded-lg border border-white/10 bg-black/30 p-4 text-xs text-slate-400">
        <summary className="cursor-pointer select-none text-slate-300">
          Developer / debug: payload committed on-chain
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(networkPayload, null, 2)}
        </pre>
        <p className="mt-2">
          No health value is present — only the trial ID, an anonymous nullifier, and the
          ledger timestamp written by the contract.
        </p>
      </details>
    </div>
  );
}

function ResultIneligible({ trial, onReset }: { trial: TrialConfig; onReset: () => void }) {
  return (
    <div className="glass-card p-8">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
        Eligibility requirements not satisfied
      </div>
      <h2 className="mt-3 text-xl font-semibold">You don&apos;t currently qualify for {trial.title}</h2>
      <p className="mt-3 text-sm text-slate-400">
        The zero-knowledge circuit could not construct a valid proof for the private profile you
        entered, which means at least one inclusion or exclusion rule was not met. In keeping with
        this project&apos;s privacy model, this app does not report to the sponsor (or store
        anywhere) which specific criterion failed.
      </p>
      <button onClick={onReset} className="btn-secondary mt-6">
        Try again
      </button>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-all text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
