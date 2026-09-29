"use client";

import { useState } from "react";
import { newSeed, seedToHex, type EligibilityInputs } from "../witnesses";
import { enrollZkTrial, type EnrollResult } from "../midnight/contract-api";
import { useMidnight } from "../hooks/useMidnight";
import { joinDeployedContract, isContractDeployed } from "../utils/contract";
import WalletConnect from "./WalletConnect";

type Stage =
  | "form"
  | "proving"
  | "balancing"
  | "submitting"
  | "confirmed"
  | "ineligible"
  | "error";

const STAGE_TEXT: Record<string, string> = {
  proving: "Generating privacy proof…",
  balancing: "Waiting for wallet approval…",
  submitting: "Submitting to Midnight Preprod…",
};

export default function TrialEligibility({
  trialId,
  title,
}: {
  trialId: string;
  title: string;
}) {
  const { status: walletStatus, providers, connect } = useMidnight();
  const [stage, setStage] = useState<Stage>("form");
  const [stageDetail, setStageDetail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollResult | null>(null);
  const [count, setCount] = useState<string | null>(null);

  const [form, setForm] = useState({
    age: 32,
    biomarker: 61,
    medicationX: true,
    country: 356,
    pregnant: false,
    conditionY: false,
  });

  const walletConnected = walletStatus === "connected";

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStageDetail(null);
    setResult(null);
    setCount(null);

    if (!walletConnected) {
      try {
        await connect();
      } catch {
        return; // hook state already shows the real error
      }
    }
    if (!providers) return;

    if (!isContractDeployed()) {
      setErrorMessage(
        "No zk-trial contract address is configured for this build, so a real Preprod transaction cannot be submitted. Your inputs were not sent anywhere.",
      );
      setStage("error");
      return;
    }

    // The private health values live only in this closure and inside the
    // circuit run. They are never fetched, logged, or persisted.
    const inputs: EligibilityInputs = { ...form };
    const seed = newSeed();

    setStage("proving");
    try {
      const joined = await joinDeployedContract(providers);
      if (!joined.ok) {
        setErrorMessage(joined.error);
        setStage("error");
        return;
      }

      const enrolled = await enrollZkTrial(providers, joined.contract, inputs, seed, {
        onProving: () => setStage("proving"),
        onBalancing: () => setStage("balancing"),
        onSubmitting: () => setStage("submitting"),
      });

      setResult(enrolled);
      setStage("confirmed");
      setStageDetail(
        "Your participant seed (shown as Anonymous ID) is the only handle this enrollment produced. Store it if you want to prove you enrolled; it cannot be linked to your health data.",
      );
      void seedToHex(seed); // available for debugging without printing by default
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Circuit assertion failures surface as unsatisfiable proofs.
      if (/assert|satisf|circuit|proof/i.test(msg) && !/network|indexer|balance|submit/i.test(msg)) {
        setStage("ineligible");
        return;
      }
      setErrorMessage(msg);
      setStage("error");
    }
  }

  async function refreshCount() {
    const { fetchEnrollmentCount } = await import("../midnight/contract-api");
    const { resolveContractAddress } = await import("../utils/contract");
    if (!providers) return;
    const address = resolveContractAddress();
    if (!address) return;
    try {
      const c = await fetchEnrollmentCount(providers, address);
      if (c !== null) setCount(c.toString());
    } catch {
      setCount(null);
    }
  }

  if (stage === "confirmed" && result) {
    void refreshCount();
    return (
      <div className="glass-card p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Enrollment confirmed
        </div>
        <h2 className="mt-3 text-xl font-semibold">
          Your anonymous enrollment for {title} is on Midnight Preprod
        </h2>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <Field label="Trial" value={trialId} />
          <Field
            label="Anonymous ID (nullifier)"
            value={`${result.nullifierHex.slice(0, 16)}…`}
            mono
          />
          <Field label="Transaction ID" value={result.txId} mono />
          {result.blockHeight !== null && (
            <Field label="Block height" value={String(result.blockHeight)} />
          )}
          <Field
            label="Public enrollment count"
            value={count ?? "Loading…"}
          />
        </dl>

        <p className="mt-4 text-xs text-slate-500">{stageDetail}</p>

        <p className="mt-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-400">
          Age, biomarker level, medication status, country, pregnancy status,
          and condition status were processed only inside the zero-knowledge
          circuit in your browser. None of them appear in the transaction or in
          any public contract state.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setStage("form");
              setResult(null);
            }}
            className="btn-secondary"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (stage === "ineligible") {
    return (
      <div className="glass-card p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
          Eligibility requirements not satisfied
        </div>
        <h2 className="mt-3 text-xl font-semibold">
          You don&apos;t currently qualify for {title}
        </h2>
        <p className="mt-3 text-sm text-slate-400">
          The zero-knowledge circuit could not construct a valid proof for the
          private profile you entered, so no transaction was submitted and
          nothing was recorded on-chain. Consistent with the privacy model,
          zk-trial does not reveal which criterion failed — not to the sponsor,
          and not on-chain.
        </p>
        <button onClick={() => setStage("form")} className="btn-secondary mt-6">
          Try again
        </button>
      </div>
    );
  }

  if (
    stage === "proving" ||
    stage === "balancing" ||
    stage === "submitting"
  ) {
    return (
      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold">
          {STAGE_TEXT[stage] ?? "Working…"}
        </h2>
        <ul className="mt-6 space-y-3 text-sm">
          <StageRow done label="Checking private eligibility (ZK circuit)" />
          <StageRow
            done={stage !== "proving"}
            active={stage === "proving"}
            label="Generating privacy proof"
          />
          <StageRow
            done={stage === "submitting" || stage === "balancing" && false}
            active={stage === "balancing"}
            label="Waiting for wallet approval (1AM Wallet)"
          />
          <StageRow
            active={stage === "submitting"}
            label="Submitting to Midnight Preprod"
          />
        </ul>
        {stageDetail && (
          <p className="mt-6 text-xs text-slate-500">{stageDetail}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleEnroll} className="glass-card space-y-5 p-8">
      <div>
        <h2 className="text-lg font-semibold">Check your eligibility</h2>
        <p className="mt-1 text-sm text-accent-glow">
          These values are processed locally in your browser inside a
          zero-knowledge circuit. They are never transmitted, logged, or stored.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <WalletConnect />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="zk-age">
            Age
          </label>
          <input
            id="zk-age"
            type="number"
            className="field-input"
            value={form.age}
            min={0}
            max={120}
            onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="zk-biomarker">
            Biomarker A
          </label>
          <input
            id="zk-biomarker"
            type="number"
            className="field-input"
            value={form.biomarker}
            min={0}
            max={200}
            onChange={(e) =>
              setForm({ ...form, biomarker: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="field-label" htmlFor="zk-country">
            Country
          </label>
          <select
            id="zk-country"
            className="field-input"
            value={form.country}
            onChange={(e) =>
              setForm({ ...form, country: Number(e.target.value) })
            }
          >
            <option value={356}>India (IN)</option>
            <option value={840}>United States (US)</option>
            <option value={826}>United Kingdom (GB)</option>
          </select>
        </div>
        <div className="col-span-2 grid gap-3 sm:grid-cols-3">
          <Check
            id="zk-med"
            label="Currently taking Medication X"
            checked={form.medicationX}
            onChange={(v) => setForm({ ...form, medicationX: v })}
          />
          <Check
            id="zk-preg"
            label="Currently pregnant"
            checked={form.pregnant}
            onChange={(v) => setForm({ ...form, pregnant: v })}
          />
          <Check
            id="zk-cond"
            label="Diagnosed with Condition Y"
            checked={form.conditionY}
            onChange={(v) => setForm({ ...form, conditionY: v })}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Demo data only. Do not enter real personal health information. A real
        Midnight Preprod transaction is submitted when you enroll — approve it
        in 1AM Wallet.
      </p>

      <button
        type="submit"
        disabled={walletStatus === "connecting"}
        className="btn-primary w-full"
      >
        {walletConnected
          ? "Prove eligibility and enroll anonymously"
          : "Connect 1AM Wallet and enroll"}
      </button>
    </form>
  );
}

function StageRow({
  done,
  active,
  label,
}: {
  done?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          done
            ? "bg-emerald-500/20 text-emerald-300"
            : active
              ? "animate-pulse bg-accent-purple/30 text-accent-glow"
              : "bg-white/5 text-slate-600"
        }`}
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done || active ? "text-slate-200" : "text-slate-500"}>
        {label}
      </span>
    </li>
  );
}

function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-black/30 accent-accent-purple"
      />
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-all text-slate-200 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
