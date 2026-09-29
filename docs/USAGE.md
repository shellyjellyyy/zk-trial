# Usage Guide

How to run zk-trial end to end: connect 1AM Wallet, deploy the contract,
enroll as a participant, and read the sponsor dashboard. Everything here
talks to **Midnight Preprod** through **Midnight.js** and the **Compact**
contract; no Stellar/Soroban/Circom/snarkjs code exists in this project.

## 0. Production deployment (live)

A production deployment is live and pointed at a real deployed contract:

| | |
|---|---|
| URL | https://zk-trial-kaiqa94aj-shailja-srivastav.vercel.app |
| Network | Midnight Preprod |
| Contract | `dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3` |

The steps below describe running the same flow locally.

## 1. Prerequisites

| What | Why | Where |
|---|---|---|
| Node.js ≥ 22 | build/run the app | https://nodejs.org |
| Compact devtools + toolchain 0.31.1 | recompile the contract (optional) | https://docs.midnight.network |
| 1AM Wallet (Chrome) | connect, prove, sign, submit | https://1am.xyz |
| Midnight Preprod selected in 1AM | the app refuses other networks | 1AM settings |

No NIGHT or DUST is required: 1AM's ProofStation sponsors proving and fees.

## 2. Start the app locally

```bash
npm ci
npm run copy:zk-assets
npm run dev
# open http://localhost:3000
```

`npm run copy:zk-assets` copies the compiled prover/verifier keys and zkIR
files from `managed/zk-trial/` into `public/zk/` so the browser can fetch
them at `/zk/keys/*` and `/zk/zkir/*` (the build does this automatically via
`prebuild`).

## 3. Deploy the contract (one-time, sponsor action)

1. Open **Sponsor Dashboard** (`/sponsor`).
2. You will see an honest "not deployed yet" notice plus the
   **Deploy the zk-trial contract** panel.
3. Click **Connect 1AM Wallet and deploy**.
4. Approve the connection in the 1AM popup (the wallet must be on
   **preprod** — the app verifies this and errors clearly otherwise).
5. The panel runs the real `deployContract()` pipeline:
   - constructor args: `TRIAL-001` + sponsor name (the ONLY public data)
   - ZK proof of the constructor via your 1AM wallet's proving provider
   - balancing by the wallet (ProofStation sponsors the dust)
   - submission relayed by the wallet to Midnight Preprod
   - finalization confirmed via the Preprod indexer
6. On success the panel prints:
   - **Contract address** (also stored in this browser's localStorage so the
     app works immediately)
   - **Deployment transaction** id
   - the block height it confirmed in

### Make the address permanent for all visitors

Set it in your deployment environment (e.g. the Vercel dashboard) or
`.env.local`:

```bash
NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS=<address printed by the deploy panel>
```

Rebuild/redeploy. Visitors without a browser-side deploy use this baked-in
address; it is the single source of truth for "which contract is live".

## 4. Enroll as a participant

1. Open **Trials → TRIAL-001** (`/trials/TRIAL-001`).
2. Read the inclusion/exclusion criteria on the trial card.
3. Fill in your **synthetic** private health values:
   age, biomarker A, country, Medication X, pregnancy, Condition Y.
4. Click **Connect 1AM Wallet and enroll** (or connect first via the
   wallet card, then click **Prove eligibility and enroll anonymously**).
5. The status panel walks the real pipeline:
   - `Generating privacy proof…` — witnesses run in your browser, the
     circuit asserts every criterion, the ZK proof is produced
   - `Waiting for wallet approval…` — 1AM balances the transaction
     (ProofStation sponsors fees)
   - `Submitting to Midnight Preprod…` — the wallet relays the sealed tx
6. On finalization the confirmed card shows:
   - your **anonymous ID (nullifier)** — 32-byte, trial-scoped
   - **Transaction id** and **block height**
   - the **public enrollment count** (read from chain state)
7. Nothing is claimed before finalization. Failures surface the real error;
   an unsatisfiable circuit shows
   *"Eligibility requirements not satisfied"* with no criterion revealed.

### Try the privacy properties

- Set **Age = 72** (or tick *pregnant*) → the circuit cannot construct a
  proof → "Eligibility requirements not satisfied", no transaction, nothing
  written on-chain.
- Enroll once, then enroll again with the same participant seed → the
  contract rejects the duplicate nullifier
  ("Already enrolled in this trial").

## 5. Sponsor dashboard

`/sponsor` reads public chain state **without a wallet** (providerless
read-only path through the Preprod indexer):

- **Verified enrollments** — the on-chain counter
- **Contract / Indexer** — the live addresses being read
- **Refresh now** — manual re-poll (auto-polls every 30 s)

The panel at the bottom states exactly what the sponsor can and cannot see.
The dashboard shows nothing rather than a mocked number when the contract is
not deployed.

## 6. What never leaves your browser

The form values are witness inputs read only by the `eligibility` witness in
`src/witnesses.ts` at proving time. They are never `fetch()`ed, logged,
placed in a URL, or written to any provider. The on-chain payload of an
enrollment is:

```
enroll() → nullifier = H(domain || trialId || seed)   [disclosed]
         → enrollments += 1                            [public counter]
```

That is the entire public footprint. See [`SECURITY.md`](../SECURITY.md).

## 7. Recompiling the contract

```bash
# needs the Compact CLI (WSL on Windows)
compact update 0.31.1
compact compile +0.31.1 contracts/zk-trial.compact managed/zk-trial
npm run copy:zk-assets
npm test          # re-run the 37 tests
```

CI fails if `managed/` differs from what the committed source compiles to,
so always commit regenerated artifacts together with the `.compact` change.

## 8. Troubleshooting

| Symptom | Meaning / fix |
|---|---|
| "1AM Wallet not detected…" | Install/unlock 1AM and reload |
| "1AM Wallet is connected to X but zk-trial targets preprod" | Switch the network in 1AM settings, reconnect |
| "No zk-trial contract address is configured" | Deploy via the sponsor dashboard, then set `NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS` |
| "Expected ZK artifact, but received text/html" | `/zk/` assets not served — run `npm run copy:zk-assets` and restart dev |
| "Enrollment transaction was finalized with status FailEntirely" | The guaranteed segment failed (e.g. duplicate nullifier); nothing was recorded |
| Verifier key mismatch on join | `managed/` no longer matches the deployed contract — recompile or redeploy |
