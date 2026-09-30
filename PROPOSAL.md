# zk-trial — Level 4 Submission Proposal

**Private clinical-trial matching on Midnight with Compact zero-knowledge
proofs, Midnight.js, and 1AM Wallet.**

## Problem

Trial recruitment forces participants to hand raw medical data (age,
biomarkers, medications, conditions, country, pregnancy status) to a sponsor
just to learn whether they qualify — often long before there is any reason
for the sponsor to see that data. A candidate who fails one criterion must
reveal *which* one and *what value* they had. This is a privacy problem, not
a matching problem.

## Solution

zk-trial lets a participant prove, with a single zero-knowledge proof, that
their private health profile satisfies **every** inclusion and exclusion
rule of a trial simultaneously — without revealing any underlying value.
The sponsor learns only: trial ID, sponsor name, an anonymous trial-scoped
nullifier, and a public enrollment counter.

### Eligibility rules proven (TRIAL-001)

| Rule | Kind |
|---|---|
| age 18–65 | inclusion |
| biomarker 40–80 | inclusion |
| currently taking Medication X | inclusion |
| resident of India (ISO-3166 numeric 356) | inclusion |
| not pregnant | exclusion |
| does not have Condition Y | exclusion |

All six are `assert`s inside the `enroll` circuit
(`contracts/zk-trial.compact`). An ineligible profile makes the constraint
system unsatisfiable: no witness, no proof, no transaction.

## Stack (as required)

| Requirement | Implementation |
|---|---|
| Midnight | Midnight **Preprod** (`preprod`) |
| Compact | `contracts/zk-trial.compact`, language 0.23, toolchain 0.31.1 |
| Midnight.js | `@midnight-ntwrk/midnight-js` 4.1.1 + `midnight-js-contracts` (`deployContract` / `findDeployedContract` / `callTx`) |
| 1AM Wallet | Midnight DApp Connector API (`window.midnight['1am']`), official `midnight-js-dapp-connector-proof-provider` for proving, `balanceUnsealedTransaction` for fee-sponsored balancing, `submitTransaction` for relay |
| React/TypeScript | Next.js 15 App Router, React 18.3, TS 5.6, Tailwind |
| Real contract interaction | deploy, join, prove, balance, submit, finalize, read counter — all through the wallet + network, no mocks |
| Real Preprod deployment | one-click deploy panel on the sponsor dashboard through 1AM Wallet; address recorded and injected via `NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS` |

No Circom, no snarkjs, no Stellar, no Soroban, no Freighter, no Lace.

## Privacy model (one paragraph)

Health values exist only as witness inputs executed in the participant's
browser at proving time. The circuit derives the anonymous nullifier itself
(`H(domain ‖ trialId ‖ seed)`), inserts it into an on-chain set, and
increments a public counter. The entire public footprint of an enrollment
is 32 bytes plus `+1`. The sponsor dashboard reads chain state without a
wallet and its provider set throws on any attempt to prove/balance/submit.

## Verification (what has actually been run)

| Claim | Evidence |
|---|---|
| Compact contract compiles with pinned toolchain | `compact compile +0.31.1 contracts/zk-trial.compact managed/zk-trial` → "Compiling 2 circuits:", zero diff vs committed `managed/` |
| Contract logic (criteria, privacy, nullifiers, dedup, counter, cross-trial separation) | `npx vitest run` → **37/37 passing** (35 Compact contract tests + 2 runtime-identity regression tests) |
| Type safety | `npx tsc --noEmit` → clean |
| Lint | `npm run lint` → "No ESLint warnings or errors" |
| Production build | `npm run build` → all routes generated (/, /sponsor, /trials/TRIAL-001) |
| CI runs the same commands | `.github/workflows/ci.yml` (compile + artifact-diff + tests + tsc + lint + build) |

Network operations (deploy, enroll) require a real 1AM Wallet in a browser
and are performed manually through the app; their results (contract address,
transaction ids) are recorded in `README.md` only after they actually
happen — never before.

## Repository & milestones

- Remote: https://github.com/shellyjellyyy/zk-trial
- Live demo: https://zk-trial-kaiqa94aj-shailja-srivastav.vercel.app
- Deployed contract (Midnight Preprod):
  `dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3`
- 18 meaningful commits covering: Compact privacy core, contract test
  coverage, removal of the legacy prototype stack, Midnight.js provider
  stack, 1AM Wallet integration, UI rewrite, Preprod configuration,
  real deployment + enrollment, CI, and docs.

## Public announcement

The project announcement post is live on X:
https://x.com/shellyjelllyyyy/status/2105060189300986082

## Real network evidence

| Artifact | Value |
|---|---|
| Network | Midnight Preprod |
| Contract address | `dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3` |
| Example enrollment tx | `00f78951dd1250f4e0559ac80a7d49c5d7b8f7a445548028dab59e6c60bd02bb18` |
| Wallet | 1AM Wallet (DApp Connector, ProofStation-sponsored fees) |

## What remains manual (honest list)

- ~~Product X launch post~~ **published**:
  https://x.com/shellyjelllyyyy/status/2105060189300986082
- **Demo video** (optional polish; script ready in `docs/DEMO_SCRIPT.md`).
- Evidence screenshots for the submission form (four core shots captured;
  checklist in `docs/EVIDENCE_CHECKLIST.md`).

## License

MIT
