import Link from "next/link";
import { TRIALS } from "@zk-trial/lib/trial/trials";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mb-6 inline-block rounded-full border border-accent-purple/30 bg-accent-purple/10 px-3 py-1 text-xs font-medium text-accent-glow">
          Research / demo MVP · synthetic data only
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">zk-trial</h1>
        <p className="mt-4 text-lg text-slate-300">
          Prove clinical trial eligibility without exposing your medical history.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href={`/trials/${TRIALS[0].trialId}`} className="btn-primary">
            Check Eligibility
          </Link>
          <Link href="/sponsor" className="btn-secondary">
            View Sponsor Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          title="Private health data"
          body="Your age, biomarkers, medication, and condition status stay in your browser. They are never sent to the sponsor or written on-chain."
        />
        <FeatureCard
          title="Zero-knowledge eligibility proof"
          body="A Groth16 circuit checks every inclusion and exclusion rule at once and produces a proof that you qualify — without revealing why."
        />
        <FeatureCard
          title="Anonymous enrollment"
          body="A trial-scoped nullifier, derived only from a local secret, lets the contract stop duplicate enrollment without learning who you are."
        />
        <FeatureCard
          title="Transparent public counts"
          body="Anyone can see how many participants have verified eligibility for a trial, recorded immutably on Stellar/Soroban."
        />
      </div>

      <div className="mt-24 glass-card p-8">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="mt-6 grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
          <Step n={1} title="Enter private data locally">
            Fill in synthetic health values in the browser. Nothing is transmitted yet.
          </Step>
          <Step n={2} title="Generate & verify a ZK proof">
            snarkjs computes a Groth16 proof client-side, then verifies it before anything is sent.
          </Step>
          <Step n={3} title="Submit an anonymous enrollment">
            Only trial ID, proof-derived nullifier, and timestamp reach the Soroban contract.
          </Step>
        </ol>
      </div>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-card p-6">
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent-purple/20 text-xs font-semibold text-accent-glow">
        {n}
      </div>
      <p className="font-medium text-white">{title}</p>
      <p className="mt-1 text-slate-400">{children}</p>
    </li>
  );
}
