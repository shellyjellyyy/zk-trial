# zk-trial

**Prove clinical-trial eligibility with a zero-knowledge proof — without exposing a single health value.**

zk-trial is a private clinical-trial eligibility verification prototype built on
**Midnight**: a Compact zero-knowledge circuit proves that a participant's
synthetic health profile satisfies every inclusion and exclusion rule of a
trial, while the raw inputs stay in the participant's browser and the public
ledger sees only an anonymous, trial-scoped nullifier and a counter.

> **Research / demo MVP.** Built for the Rise In × Midnight
> *"New Moon to Full: Monthly Moonshots on Midnight"* Level 4 submission. Uses
> **entirely synthetic health data**. Not a medical device, not a real
> clinical-trial enrollment system, not medical advice. See
> [`SECURITY.md`](./SECURITY.md) for the full disclaimer and threat model.

| | |
|---|---|
| **Live demo** | [https://zk-trial-qin0ddun1-shailja-srivastav.vercel.app/](https://zk-trial-qin0ddun1-shailja-srivastav.vercel.app/) |
| **Demo video** | [https://www.loom.com/share/1edb951a957a4dc097ee4c3293619d58](https://www.loom.com/share/1edb951a957a4dc097ee4c3293619d58) |
| **Network** | Midnight **Preprod** |
| **Contract** | `dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3` |
| **Wallet** | [1AM Wallet](https://1am.xyz) (Chrome extension) |
| **Stack** | Compact · Midnight.js · 1AM Wallet · Next.js · TypeScript |
| **Repository** | https://github.com/shellyjellyyy/zk-trial |
| **X (announcement post)** | https://x.com/shellyjelllyyyy/status/2105060189300986082 |

[![CI](https://github.com/shellyjellyyy/zk-trial/actions/workflows/ci.yml/badge.svg)](https://github.com/shellyjellyyy/zk-trial/actions/workflows/ci.yml)

---

## Problem

Clinical-trial recruitment normally requires participants to hand raw medical
data — age, biomarker levels, medications, pregnancy status, conditions — to a
sponsor just to learn whether they qualify. A candidate who fails one
criterion must reveal *which* one, and *what value* they had. Sensitive health
information is disclosed long before there is any reason for the sponsor to
see it, and it cannot be un-disclosed.

This is a privacy problem, not a matching problem.

## Solution

zk-trial lets a participant prove, with a **single zero-knowledge proof**,
that their private health profile satisfies **every** inclusion and exclusion
rule of a trial simultaneously — without revealing any underlying value:

- The eligibility rules are `assert`s **inside the Compact circuit**
  (`contracts/zk-trial.compact`). An ineligible profile makes the constraint
  system unsatisfiable: no proof, no transaction, nothing on-chain.
- The raw eligibility values exist only as **witness inputs** read in the
  participant's browser at proving time. They are never transmitted, logged,
  or stored on-chain.
- The circuit itself derives an **anonymous, trial-scoped nullifier** from a
  private seed and returns it as the proof's public output. The on-chain
  footprint of an enrollment is exactly 32 bytes plus `+1` on a public counter.
- The transaction is proven, balanced, and submitted through the participant's
  own **1AM Wallet** — there is no server-side signer anywhere in this project.

The sponsor reads live contract state and sees a running enrollment count and
anonymous nullifier set — never a participant, and never a health value.

## Key Features

- **Private eligibility verification** — all six criteria enforced inside the
  ZK circuit, not in frontend code
- **Compact ZK circuit** — `contracts/zk-trial.compact`, compiled with the
  pinned Compact toolchain 0.31.1
- **Midnight Preprod** — real network, real indexer, real finalization
- **1AM Wallet** — connect, prove, balance, and submit through the DApp
  Connector API (`window.midnight['1am']`)
- **Anonymous enrollment / nullifier** — trial-scoped, derived inside the
  circuit, inserted into an on-chain used-nullifier set (duplicate enrollment
  is rejected by ledger state, not by UI policy)
- **Public enrollment count** — readable by anyone via the Preprod indexer,
  no wallet required
- **Sponsor dashboard** — wallet-free read-only view of live contract state
- **Real signed transaction flow** — deploy, prove, balance, submit,
  finalize; the UI reports success only after the indexer confirms a
  succeeding transaction, and displays the real transaction id and block height

## Eligibility Criteria

For the synthetic trial `TRIAL-001`:

| # | Criterion | Kind |
|---|---|---|
| 1 | age 18–65 | inclusion |
| 2 | biomarker 40–80 | inclusion |
| 3 | medication_x = true (currently taking Medication X) | inclusion |
| 4 | country = India / IN (ISO-3166 numeric 356) | inclusion |
| 5 | pregnant = false | exclusion |
| 6 | condition_y = false | exclusion |

**These are synthetic demonstration criteria.** There is no real trial, no
real sponsor, no real biomarker, and no real patients. They exist to
demonstrate the privacy flow end to end.

## Privacy Model

| Value | In browser | On-chain | Visible to sponsor |
|---|:---:|:---:|:---:|
| age | yes | **no** | **no** |
| biomarker level | yes | **no** | **no** |
| medication status | yes | **no** | **no** |
| country (raw value) | yes | **no** | **no** |
| pregnancy status | yes | **no** | **no** |
| condition status | yes | **no** | **no** |
| participant seed (private) | yes | **no** | **no** |
| anonymous nullifier (32 bytes) | derived in-circuit | yes | yes |
| trial ID | yes | yes | yes |
| sponsor name | yes | yes | yes |
| enrollment counter | — | yes | yes |
| used-nullifier set | — | yes | yes |

Precisely stated:

- **PRIVATE:** the eligibility inputs, all health-related values, and the
  participant identity (seed). These are witness inputs consumed by the
  circuit in the browser; the shipped code contains no path that transmits
  them.
- **PUBLIC:** the trial ID, the enrollment count, the necessary
  anonymous/nullifier state, and contract/network information (contract
  address, indexer endpoints).

What the sponsor learns from an enrollment: *someone with a valid proof
enrolled, and this is their anonymous trial-scoped nullifier.* What they do
not learn: any input value, which criterion a rejected candidate failed, or
who the participant is. A rejected candidate produces no transaction at all —
the circuit refuses to construct a proof.

## Architecture

```
Participant
  │  enters synthetic private eligibility inputs
  ▼
Private eligibility inputs          (age, biomarker, medication, country,
  │                                  pregnancy, condition + private seed)
  ▼
Browser / Compact ZK execution      (witnesses in src/witnesses.ts feed the
  │                                  `enroll` circuit; every criterion is a
  │                                  circuit assert; no proof if ineligible)
  ▼
1AM Wallet                          (DApp Connector: proving provider,
  │                                  balanceUnsealedTransaction, submission)
  ▼
Midnight Preprod                    (transaction finalized by the network;
  │                                  verifier keys checked against the
  │                                  deployed contract state)
  ▼
Anonymous enrollment state          (32-byte nullifier inserted into the
  │                                  on-chain set; counter +1)
  ▼
Sponsor Dashboard                   (reads live state via the Preprod
                                     indexer — no wallet, read-only)
```

Components:

- **Compact contract** (`contracts/zk-trial.compact`) — ledger state is
  exactly `trialId`, `sponsor`, `enrollments: Counter`,
  `usedNullifiers: Set<Bytes<32>>`; the `enroll` circuit asserts all six
  criteria, derives and discloses the nullifier, rejects reuse, and
  increments the counter.
- **Witnesses** (`src/witnesses.ts`) — the only place health data exists;
  browser-side, executed at proving time.
- **Midnight.js providers** (`src/midnight/providers.ts`) — the standard
  six-provider Midnight.js stack: in-memory private state, Preprod indexer
  public data, fetch-based ZK artifact config, 1AM proving, 1AM balancing,
  1AM submission.
- **1AM Wallet** (`src/midnight/wallet.ts`) — discovered via the Midnight
  DApp Connector API at `window.midnight['1am']`; network mismatch is
  detected and surfaced.
- **Sponsor dashboard** (`src/app/sponsor/page.tsx`) — providerless read-only
  path through the Preprod indexer; its provider set throws on any attempt
  to prove, balance, or submit.

A longer walkthrough, including the exact transaction lifecycle, is in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Why Midnight

Midnight's Compact language puts the privacy boundary **in the contract
itself**: the same circuit that defines the ledger's public state also
defines what must remain provable-but-unstated. That is exactly the shape
this problem needs:

- Eligibility is enforced **by the proof system**, not by app logic — an
  ineligible input cannot yield an accepted enrollment, because no proof
  exists for it. There is no "frontend checked it, contract trusts it" gap.
- The circuit **returns** the nullifier as public proof output, so a prover
  cannot attach an arbitrary nullifier to a valid proof.
- The proof is verified by the network as part of transaction validation —
  an invalid proof never produces a ledger update. This is a Midnight
  protocol property, not application code.
- Midnight.js gives the complete transaction lifecycle (build → prove →
  balance → submit → finalize) from the browser, with the wallet as the
  signer and no server-side key material anywhere.

These are properties demonstrated by the shipped implementation; for the
authoritative description of Midnight's protocol-level guarantees, see the
[Midnight documentation](https://docs.midnight.network).

## Live Demo

https://zk-trial-qin0ddun1-shailja-srivastav.vercel.app

## 🎥 Demo

Watch the full walkthrough of the enrollment flow, the sponsor dashboard, and
the proving pipeline:

https://www.loom.com/share/1edb951a957a4dc097ee4c3293619d58

Open **Trials → TRIAL-001** to run the enrollment flow (requires the 1AM
Wallet extension on Midnight Preprod), or open **Sponsor Dashboard** to see
the public enrollment count read live from chain state — no wallet needed.

Screenshots of the running app (landing page, connected-wallet enrollment,
confirmed transaction, sponsor dashboard) are prepared for the submission
and will be added under `docs/screenshots/`.

## Network

**Midnight Preprod** (`preprod`). The app registers the network id once at
module load (`src/midnight/config.ts`) and refuses a wallet connected to any
other network. Public indexer:
`https://indexer.preprod.midnight.network/api/v4/graphql`.

## Contract

Deployed zk-trial Compact contract on Midnight Preprod:

```
dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3
```

The address is injected to the app via `NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS`
(see [Environment Variables](#environment-variables)). The contract was
deployed through the in-app sponsor deploy panel with 1AM Wallet; no CLI
deployment script is required.

## Wallet

[**1AM Wallet**](https://1am.xyz) — the browser extension for Midnight. It
provides the DApp Connector API, the proving provider (ProofStation — fees
and proving are sponsored, so no token funding is needed to try the demo),
transaction balancing, and submission relay.

## Example Successful Transaction

A real, successful enrollment transaction on Midnight Preprod:

```
00f78951dd1250f4e0559ac80a7d49c5d7b8f7a445548028dab59e6c60bd02bb18
```

This is an example of a successful Preprod enrollment: the `enroll` circuit
was proven with synthetic private inputs, the transaction was approved and
balanced by 1AM Wallet, finalized on Midnight Preprod, and the public
enrollment counter incremented. No participant information is attached to or
derivable from this section — the transaction's public content is the
anonymous nullifier and the counter increment.

## Local Setup

Prerequisites: Node.js ≥ 22, npm.

```bash
git clone https://github.com/shellyjellyyy/zk-trial
cd zk-trial
npm install          # postinstall normalizes Midnight exports maps
npm test             # 37 contract/identity tests
npm run dev          # http://localhost:3000
```

All scripts that exist in `package.json`:

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (copies ZK assets first via `predev`) |
| `npm run build` | production build (copies ZK assets first via `prebuild`) |
| `npm start` | serve the production build |
| `npm test` | run the full Vitest suite (37 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run contract:test` | the Compact contract tests only (`tests/zk-trial.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`next lint`) |
| `npm run compact:compile` | recompile `contracts/zk-trial.compact` → `managed/zk-trial` (needs the Compact CLI, toolchain 0.31.1) |
| `npm run compact:format` | check Compact source formatting |
| `npm run copy:zk-assets` | copy compiled ZK artifacts from `managed/` into `public/zk` |

Recompiling the contract requires the [Compact devtools](https://docs.midnight.network)
(toolchain 0.31.1). CI recompiles and fails on any diff against the committed
`managed/` artifacts, so the committed keys always correspond to the
committed source.

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS` | Address of the deployed zk-trial contract (the Preprod address above). Read by the app to join and read contract state. |
| `NEXT_PUBLIC_MIDNIGHT_NETWORK` | Target Midnight network; defaults to `preprod`. Keep in sync with `src/midnight/config.ts`. |
| `NEXT_PUBLIC_ZK_ASSETS_BASE_URL` | Optional. Override only if ZK artifacts are hosted on a CDN instead of the app's own `/zk/` path. |
| `NEXT_PUBLIC_PROOF_SERVER_URL` | Optional HTTP proof-server fallback, used only if the connected wallet exposes no proving provider. 1AM always does, so this normally stays empty. |

Copy `.env.example` to `.env.local` for local development. **`.env.local` is
local configuration and must not be committed** — it is git-ignored. All
variables are `NEXT_PUBLIC_*` (public by design: a contract address and
network endpoints are public information). There is no secret in this
project: no `PRIVATE_KEY`, seed, or mnemonic exists anywhere, because
signing and proving happen in the participant's own wallet.

## Testing

The full suite is green: **37/37 tests passing**.

```bash
npm test
```

Coverage highlights (`tests/zk-trial.test.ts`, 35 contract tests + a
2-test runtime-identity regression suite):

- every eligibility criterion enforced (age <18 / >65, biomarker <40 / >80,
  missing Medication X, wrong country, pregnant, Condition Y — all reject)
- valid synthetic profile enrolls and receives a 32-byte nullifier
- public enrollment counter increments and agrees with the read circuit
- repeated nullifier rejected (duplicate enrollment prevention)
- two trials derive different, unlinkable nullifiers from the same seed
  (cross-trial separation)
- the participant seed never appears in public ledger state (privacy)

Additionally verified (manually and in CI):

- **Compact compilation** — toolchain 0.31.1 reproduces the committed
  `managed/` artifacts byte-for-byte
- **Typecheck** — `tsc --noEmit` clean
- **Lint** — ESLint clean
- **Production build** — `next build` succeeds (all routes)
- **CI** — GitHub Actions green on every push

## CI/CD

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push
and pull request:

1. checkout, Node 22, `npm ci`
2. required/forbidden file check (`scripts/check-required-files.mjs`)
3. install Compact devtools, pin toolchain 0.31.1
4. `compact compile` and **fail on any diff** against committed `managed/`
   artifacts (source/artifact parity)
5. `npx vitest run` (37 tests)
6. `npx tsc --noEmit`
7. `npm run lint`
8. `npm run build`

Badged above — it is the repository's real workflow, not a decoration.

## Deployment

The frontend is deployed on **Vercel** from this repository
(`vercel.json` pins the framework, install, and build commands). The live
production deployment is the [demo link](#live-demo) above.

The Compact contract is deployed to **Midnight Preprod** through the app
itself: Sponsor Dashboard → *Connect 1AM Wallet and deploy*, which runs the
real `deployContract()` pipeline (constructor proof via the wallet's proving
provider, wallet balancing, wallet relay, indexer finalization). That is how
the recorded contract address above was produced — no deployment CLI was
used. To point a new deployment at the recorded contract, set
`NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS` and redeploy.

## Security

See [`SECURITY.md`](./SECURITY.md) for the data-handling policy, the
nullifier construction and its limitations, the threat model, and the
explicit list of what this prototype does **not** defend against.

## Threat Model

Summary (full version in [`SECURITY.md`](./SECURITY.md)):

**Defended (by the shipped implementation):**
- sponsor/on-chain observer learning any eligibility value — impossible by
  construction: the values exist only as browser-side witness inputs
- duplicate enrollment with the same seed — rejected by the on-chain
  used-nullifier set
- cross-trial correlation via nullifiers — trial-scoped hash inputs
- prover attaching an arbitrary nullifier — the circuit computes and returns it
- ineligible profile being accepted — the circuit asserts make the constraint
  system unsatisfiable
- talking to a contract compiled from different source — the SDK's join path
  validates deployed verifier keys against the local compiled artifacts

**Not defended (documented, not hidden):**
- Sybil enrollment via fresh browser state (the seed is session-scoped)
- confidentiality of the trial criteria (intentionally public)
- security of the 1AM Wallet extension / ProofStation themselves (third party)
- Preprod is a test network: resets and protocol changes are possible
- anything resembling production clinical-trial compliance, KYC, or real
  patient data handling

## Limitations

- **Synthetic data only.** No real patients, sponsors, biomarkers, or trials.
- **Prototype/MVP.** Built for a hackathon submission; expect MVP-quality
  operational hardening.
- **Preprod.** Midnight Preprod is a test network; nothing here is a mainnet
  deployment, and test networks can reset.
- **Not a production clinical-trial system.** No regulatory compliance, no
  consent management, no KYC, no audit trail suitable for real research.
- **Not medical advice.** Nothing in this repository is clinical guidance.
- **No real patient data.** Do not enter real health information — the demo
  only makes sense with synthetic values.
- **Wallet/network assumptions.** Enrollment requires the 1AM Wallet
  extension on Chrome with Midnight Preprod selected; the sponsor dashboard
  requires indexer availability.
- **Session-scoped identity.** The participant seed lives in browser memory
  for the session; reloading creates a fresh identity, so Sybil resistance
  is explicitly out of scope for this MVP.
- **Unbounded nullifier set.** The on-chain used-nullifier set grows with
  enrollments (acceptable at demo scale).
- **Eligibility criteria are public** (they live in `trials/trial-001.json`);
  only the participant's values are private.

## Product X

The project announcement post is live on X:
https://x.com/shellyjelllyyyy/status/2105060189300986082

A dedicated Product X profile, if created, will be linked there as well.
The prepared profile copy, launch post, and setup checklist are in
[`docs/PRODUCT_X_SETUP.md`](./docs/PRODUCT_X_SETUP.md).

## Repository

https://github.com/shellyjellyyy/zk-trial

## License

[MIT](./LICENSE)
