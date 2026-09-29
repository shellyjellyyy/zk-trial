# Level 4 Submission Checklist — zk-trial

Status legend: **DONE** = verified in this repository · **MANUAL** = requires
your personal account/credentials, action listed · **PENDING** = not yet done ·
**BLOCKED** = cannot proceed until something else happens.

| Requirement | Evidence | Status |
|---|---|---|
| Working MVP | Real enrollment flow: Compact circuit → 1AM Wallet → Preprod → confirmed UI; sponsor dashboard reads live state | **DONE** |
| Midnight Preprod | `src/midnight/config.ts` registers `preprod`; app rejects other networks | **DONE** |
| Compact contract | `contracts/zk-trial.compact` (pragma 0.23): ledger = trialId, sponsor, enrollments Counter, usedNullifiers Set | **DONE** |
| Compact compilation | `npm run compact:compile` (toolchain 0.31.1); CI recompiles and fails on any diff vs committed `managed/` | **DONE** |
| Midnight.js | `@midnight-ntwrk/midnight-js` 4.1.1; `deployContract`/`findDeployedContract`/`callTx` in `src/midnight/contract-api.ts` | **DONE** |
| 1AM Wallet | DApp Connector discovery at `window.midnight['1am']` (`src/midnight/wallet.ts`); proving/balancing/submit via wallet | **DONE** |
| Real deployment | Contract deployed through the in-app sponsor deploy panel (1AM Wallet), not a CLI | **DONE** |
| Contract address | `dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3` (README, PROPOSAL, SECURITY, commit message) | **DONE** |
| Successful enrollment | Confirmed on Midnight Preprod; public enrollment count subsequently read as **2** in the Sponsor Dashboard | **DONE** |
| Transaction ID | `00f78951dd1250f4e0559ac80a7d49c5d7b8f7a445548028dab59e6c60bd02bb18` (README) | **DONE** |
| Block height | Displayed by the enrollment confirmation UI (`src/components/TrialEligibility.tsx` renders `blockHeight`) | **DONE** (live) · **MANUAL** (screenshot, see `EVIDENCE_CHECKLIST.md` #5) |
| Sponsor dashboard | `src/app/sponsor/page.tsx` — wallet-free indexer read, 30 s auto-poll, privacy panel | **DONE** |
| Privacy model | Circuit-only asserts; browser-only witnesses (`src/witnesses.ts`); PUBLIC vs PRIVATE documented in README + SECURITY | **DONE** |
| Tests | **37/37 passing** (`npm test`): 35 contract tests + 2 runtime-identity tests | **DONE** |
| CI/CD | `.github/workflows/ci.yml` green: compile+artifact-diff, vitest, tsc, lint, build | **DONE** |
| Public GitHub | https://github.com/shellyjellyyy/zk-trial (public) | **DONE** |
| Live Vercel demo | https://zk-trial-kaiqa94aj-shailja-srivastav.vercel.app | **DONE** |
| 15+ meaningful commits | `git rev-list --count HEAD` → **18** (clean `shellyjellyyy` authorship) | **DONE** |
| README | Submission-quality: problem, solution, privacy model, architecture, live values, setup, testing, limitations | **DONE** |
| Docs consistency | SECURITY/PROPOSAL/USAGE/ARCHITECTURE match the shipped Midnight implementation | **DONE** |
| Product X profile | Profile does **not** exist yet; copy prepared in `docs/PRODUCT_X_SETUP.md` | **MANUAL** |
| Demo video | Does **not** exist yet; script prepared in `docs/DEMO_SCRIPT.md` | **MANUAL** |
| Evidence screenshots | Checklist prepared in `docs/EVIDENCE_CHECKLIST.md` | **MANUAL** |
| Rise In submission form | Final submit on the Level 4 task page | **MANUAL** |

## What must happen manually before submission

1. Record the demo video (`docs/DEMO_SCRIPT.md`).
2. Capture the 10 evidence screenshots (`docs/EVIDENCE_CHECKLIST.md`).
3. Create the Product X profile and publish the launch post
   (`docs/PRODUCT_X_SETUP.md`).
4. Add the real Product X URL to the README "Product X" section and to
   `docs/PRODUCT_X_SETUP.md` (replace the placeholder sentence).
5. Fill in the video/screenshots links on the Rise In submission form and
   submit at
   https://www.risein.com/programs/new-moon-to-full-monthly-moonshots-on-midnight/tasks/submission/nIfMvAE5xiJxBYNZT

Nothing else in this repository blocks submission.
