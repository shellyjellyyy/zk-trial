# zk-trial

[![CI](https://github.com/shellyjellyyy/zk-trial/actions/workflows/ci.yml/badge.svg)](https://github.com/shellyjellyyy/zk-trial/actions/workflows/ci.yml)

**Prove clinical trial eligibility without exposing your medical history.**

> **Research / demo MVP.** Built for a Web3 + Zero-Knowledge Level 4
> submission. Uses **entirely synthetic health data**. Not a medical device,
> not a real clinical trial enrollment system, not medical advice. See
> [`SECURITY.md`](./SECURITY.md) for the full disclaimer and threat model.

| | |
|---|---|
| **LIVE DEMO** | `MANUAL ACTION REQUIRED — see "Frontend deployment" below` (Vercel login needed) |
| **CONTRACT** | NOT DEPLOYED YET — deploy via the sponsor dashboard (1AM Wallet), then set `NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS` |
| **NETWORK** | Midnight **Preprod** (`preprod`), indexer `https://indexer.preprod.midnight.network/api/v4/graphql` |
| **WALLET** | [1AM Wallet](https://1am.xyz) browser extension (Chrome) |
| **X / product profile** | `MANUAL ACTION REQUIRED` |
| **Demo video** | `MANUAL ACTION REQUIRED` |
| **CI** | `.github/workflows/ci.yml` — runs on every push and PR |

Everything marked `MANUAL ACTION REQUIRED` needs a personal account, wallet,
or publishing credential and cannot be produced by the code in this repository.

---

## What This Product Does

Clinical trial recruitment normally requires participants to hand raw medical
data (age, biomarkers, medications, conditions) to a sponsor just to find out
whether they qualify. zk-trial lets a participant prove with a
zero-knowledge proof that their private health profile satisfies **every**
inclusion and exclusion rule of a trial simultaneously — without revealing
any underlying value.

For TRIAL-001 the private inputs are:

- age 18–65
- biomarker 40–80
- currently taking Medication X
- resident of India (ISO-3166 numeric 356)
- not pregnant
- does not have Condition Y

What the sponsor only ever learns: the trial ID, the sponsor name, a running
public enrollment counter, and an anonymous trial-scoped nullifier. Not the
inputs, not the identity, not which criterion failed.

## Privacy Model

| Value | In browser | On-chain | Sent to sponsor |
|---|:---:|:---:|:---:|
| age | yes | **no** | **no** |
| biomarker level | yes | **no** | **no** |
| medication status | yes | **no** | **no** |
| country | yes | **no** | **no** |
| pregnancy status | yes | **no** | **no** |
| condition status | yes | **no** | **no** |
| participant seed (private) | yes | **no** | **no** |
| raw health JSON | yes | **no** | **no** |
| trial ID | yes | yes | yes |
| sponsor name | yes | yes | yes |
| anonymous nullifier | — | yes | yes |
| enrollment counter | — | yes | yes |

The health values are witness inputs to the `enroll` circuit. They are read
by the witness functions in your browser at proving time and never
transmitted. The circuit **asserts** every criterion before the transaction
can even be constructed: if any predicate fails, no proof exists, no
transaction is built, and nothing is submitted. The returned on-chain
footprint is the 32-byte nullifier and the counter increment — see
`contracts/zk-trial.compact`.

## Tech Stack

| Layer | Choice |
|---|---|
| Contract language | **Compact** (language 0.23, toolchain 0.31.1) |
| Contract runtime | `@midnight-ntwrk/compact-runtime` 0.16.0 |
| Client framework | **Midnight.js 4.1.1** (`midnight-js`, `midnight-js-contracts`, `ledger-v8`) |
| Wallet | **1AM Wallet** via Midnight DApp Connector API (`window.midnight['1am']`) |
| Proving | 1AM ProofStation via `midnight-js-dapp-connector-proof-provider` (HTTP proof-server fallback) |
| Network | **Midnight Preprod** (indexer + node via wallet config; public indexer as read-only fallback) |
| Frontend | Next.js 15.5 (App Router), React 18.3, TypeScript 5.6, Tailwind 3.4 |
| Tests | Vitest — 35 Compact contract tests |
| CI | GitHub Actions |

## Architecture

```
Browser
  ↓  private health values (witness inputs, never transmitted)
1AM Wallet
  ↓  getProvingProvider() → ZK proof · balanceUnsealedTransaction() → fees sponsored
Midnight.js (midnight-js-contracts)
  ↓  deployContract / findDeployedContract / callTx
Compact contract (contracts/zk-trial.compact)
  ↓  ZK circuit execution (eligibility asserts + nullifier + counter)
Midnight Preprod
```

The old Circom/snarkjs/Stellar/Soroban implementation was removed in
`ee7c011` and is not part of this codebase.

## Prerequisites

- Node.js ≥ 22
- Compact devtools (`compact`) with toolchain `0.31.1` —
  [install instructions](https://docs.midnight.network)
- [1AM Wallet](https://1am.xyz) browser extension (only needed to submit a
  real transaction or deploy the contract; the UI states clearly when it is
  missing)
- A Unix-like shell (WSL works on Windows) for the Compact CLI

## Setup & Run Locally

```bash
npm ci
npm run copy:zk-assets   # copies managed/ ZK artifacts into public/zk
npm run dev              # http://localhost:3000
```

### Configuration

```bash
cp .env.example .env.local
```

All variables are `NEXT_PUBLIC_*` and public by design. The contract address
stays **empty** until you deploy; the UI then shows an honest "not deployed
yet" state (see [Usage Guide](./docs/USAGE.md)).

**Where a secret would go: nowhere.** This project has no server-side
signer. Proving, balancing, and submission all happen through the
participant's own 1AM Wallet. There is no `PRIVATE_KEY`, `SEED`, `MNEMONIC`,
or `API_KEY` anywhere in this repository.

## Run Tests

```bash
npm test             # 35 Compact contract tests (eligibility, privacy,
                     # nullifiers, duplicate prevention, cross-trial isolation)
npm run compact:compile   # recompile contracts/zk-trial.compact -> managed/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build (also copies ZK assets)
```

The test suite covers:

- a valid synthetic patient enrolls and receives a 32-byte nullifier
- every criterion enforced: age <18 / >65, biomarker <40 / >80, missing
  Medication X, wrong country, pregnant, Condition Y all reject
- the public enrollment counter increments and agrees with the read circuit
- a repeated nullifier is rejected (duplicate enrollment prevention)
- two trials derive different nullifiers from the same seed (cross-trial
  separation)
- the participant seed never appears in public ledger state (privacy)

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR:

1. checkout + Node 22 + `npm ci`
2. install Compact devtools, pin toolchain 0.31.1
3. `compact compile` and **fail on any diff** against committed `managed/`
   artifacts (source/artifact parity)
4. `npx vitest run` (35 contract tests)
5. `npx tsc --noEmit`
6. `npm run lint`
7. `npm run build`

Every step is run locally before being added to CI.

## Usage Guide

See [`docs/USAGE.md`](./docs/USAGE.md) for the full walkthrough
(connect wallet, deploy, enroll, sponsor dashboard).

Short version:

1. Open `/trials/TRIAL-001`, read the criteria.
2. Enter your (synthetic) private health values.
3. Click **Connect 1AM Wallet and enroll** — approve in the wallet.
4. The circuit proves eligibility in-browser, 1AM/ProofStation proves and
   balances the transaction, and it is submitted to Midnight Preprod.
5. On finalization you see the transaction id, block height, your anonymous
   nullifier, and the public enrollment count.

## Contract Address

The contract is deployed from the sponsor dashboard (**Sponsor Dashboard →
Deploy to Midnight Preprod**) through 1AM Wallet; 1AM's ProofStation sponsors
the fees. After deployment, set the printed address:

```bash
NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS=<address from deploy panel>
```

The address is recorded here once a real deployment exists:

| Field | Value |
|---|---|
| Contract address | `NOT DEPLOYED YET` |
| Deployment tx | `NOT DEPLOYED YET` |
| Network | Midnight Preprod |

## Product X Profile

`MANUAL ACTION REQUIRED — write the X/Twitter post linking the live demo,
this repo, and the demo video.`

Suggested copy:

> zk-trial: prove you qualify for a clinical trial without revealing a
> single health value. Compact circuits on Midnight Preprod, proven in
> your browser, relayed by 1AM Wallet — age, biomarkers, and conditions
> never leave your device. The sponsor only ever sees an anonymous
> nullifier and a counter.

## Security

See [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE)
