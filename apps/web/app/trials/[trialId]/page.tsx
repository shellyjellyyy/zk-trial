import { notFound } from "next/navigation";
import { TRIALS, getTrial } from "@zk-trial/lib/trial/trials";
import EligibilityFlow from "@/components/EligibilityFlow";

export function generateStaticParams() {
  return TRIALS.map((t) => ({ trialId: t.trialId }));
}

export default function TrialPage({ params }: { params: { trialId: string } }) {
  const trial = getTrial(params.trialId);
  if (!trial) return notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="glass-card mb-8 p-8">
        <span className="text-xs font-medium uppercase tracking-wide text-accent-glow">
          {trial.trialId} · {trial.status}
        </span>
        <h1 className="mt-2 text-2xl font-semibold">{trial.title}</h1>
        <p className="mt-2 text-sm text-slate-400">{trial.description}</p>
        <p className="mt-1 text-xs text-slate-500">Sponsor: {trial.sponsor}</p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-200">Inclusion criteria</h3>
            <ul className="space-y-1 text-sm text-slate-400">
              {trial.inclusion.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="text-emerald-400">+</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-200">Exclusion criteria</h3>
            <ul className="space-y-1 text-sm text-slate-400">
              {trial.exclusion.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="text-red-400">–</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <EligibilityFlow trial={trial} />
    </div>
  );
}
