# zk-trial

**Prove clinical trial eligibility without exposing your medical history.**

> **Research / demo MVP.** Built for a Web3 + Zero-Knowledge Level 4
> submission. Uses **entirely synthetic health data**. Not a medical device,
> not a real clinical trial enrollment system, not medical advice. See
> [`SECURITY.md`](./SECURITY.md) for the full disclaimer and threat model.

| | |
|---|---|
| **LIVE DEMO** | `MANUAL ACTION REQUIRED — see "Deploy the frontend"` below (Vercel login needed) |
| **CONTRACT** | `CCWXE7V7UU72S4EPCY54WWMQDXLHUTJLC33MXE6IO4KX6IOQAKTRV55F` |
| **NETWORK** | Stellar **Testnet** (passphrase `Test SDF Network ; September 2015`), RPC `https://soroban-testnet.stellar.org` |
| **Contract explorer** | https://stellar.expert/explorer/testnet/contract/CCWXE7V7UU72S4EPCY54WWMQDXLHUTJLC33MXE6IO4KX6IOQAKTRV55F |
| **Init transaction** | `f8f565943d42bc7742109ad8b141e30262bfb16617705250b676667c7544a2e8` |
| **TRIAL-001 registration** | `853849194300d932ffd6888c8b50e1659d4851d2e8bcfc0f5f9937ff897de204` |
| **A real enrollment** | `15250c8980ca69da83c4b487f353a6452fabdbddff1541e4e005d3d836fbe11f` |
| **X / product profile** | `MANUAL ACTION REQUIRED` |
| **Demo video** | `MANUAL ACTION REQUIRED` |
| **CI** | `.github/workflows/ci.yml` — runs on every push and PR |

Everything marked `MANUAL ACTION REQUIRED` needs a personal account, wallet, or
publishing credential and cannot be produced by the code in this repository.

---

## Problem

Clinical trial recruitment normally requires participants to hand raw medical
data (age, biomarkers, medications, conditions) to a sponsor just to find out
whether they qualify — long before there is any reason for the sponsor to see
that data at all. Trial registries routinely publish eligibility criteria, but
a candidate who fails one criterion has to reveal *which* one and *what value*
they had in order to check.

## Solution

zk-trial lets a participant prove, with a zero-knowledge proof, that their
private health profile satisfies **every** inclusion and exclusion rule of a
trial simultaneously — without revealing any underlying value. The sponsor only
ever learns: the trial ID, a running public enrollment count, an anonymous
trial-scoped nullifier, and a ledger timestamp.

## Why zero-knowledge proofs

A ZK proof lets you prove a *statement about* private data without revealing
the data. Here the statement is:

> "I possess private health values `age, biomarker, medicationX, countryCode,
> pregnant, conditionY` such that they jointly satisfy TRIAL-001's inclusion and
> exclusion rules."

The circuit (`circuits/eligibility/eligibility.circom`) ANDs six predicates
together and hard-constrains the output signal `eligible === 1`. If any
predicate is false the constraint system is **unsatisfiable**, so witness
generation throws and **no proof can be constructed at all** — there is no path
to a "false but accepted" proof. That is verified by 12 automated tests.

## Architecture

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full data-flow
diagram and the reasoning behind each decision.

```
apps/web/            Next.js 14 (App Router) + TypeScript + Tailwind frontend
circuits/eligibility/ Circom 2.1.9 circuit + compiled artifacts + Groth16 keys
contracts/zk_trial/  Soroban (Rust, soroban-sdk 22) smart contract
lib/zk/              client-side proof generation + verification (snarkjs)
lib/privacy/         anonymous nullifier derivation
lib/trial/           trial config loader + AI-assisted trial discovery
lib/chain/           Soroban RPC client + Freighter wallet connector
trials/              structured trial configuration (JSON)
tests/               Node test-runner suites for the circuit and libs
scripts/             circuit compile/setup, deployment, repo checks
deployment/          recorded public deployment result (contract id, txs)
docs/                architecture notes
```

### Honest statement of what runs where

**Eligibility proofs are generated and verified client-side. Soroban provides
the immutable anonymous enrollment and audit layer.**

The Soroban contract does **not** verify the Groth16 proof, and this README does
not claim that it does. Moving verification on-chain is listed under
[Known limitations](#known-limitations) and [Future roadmap](#future-roadmap).

## Privacy model

| Value | In browser | On-chain | Sent to sponsor |
|---|:---:|:---:|:---:|
| age | yes | **no** | **no** |
| biomarker level | yes | **no** | **no** |
| medication status | yes | **no** | **no** |
| pregnancy status | yes | **no** | **no** |
| condition status | yes | **no** | **no** |
| country | yes | **no** | **no** |
| raw medical JSON | yes | **no** | **no** |
| trial ID | yes | yes | yes |
| anonymous nullifier | yes | yes | yes |
| enrollment counter | — | yes | yes |
| ledger timestamp | — | yes | yes |

The complete on-chain payload of an enrollment is two contract arguments:

```json
{ "function": "record_enrollment",
  "args": { "trial_id": "TRIAL001", "nullifier": "<32-byte sha256 digest>" } }
```

The app ships an in-page "Developer / debug" panel that prints exactly this
payload, so the claim is auditable rather than asserted. See
[`SECURITY.md`](./SECURITY.md) for the nullifier construction, its limitations,
and the trusted-setup caveats.

## ZK flow

```
private health values (browser memory only)
      │
      ▼
snarkjs witness calculation  (eligibility.wasm)
      │   ↳ if any predicate is false: assertion fails, NO witness, NO proof
      ▼
Groth16 prover              (eligibility.zkey)
      │
      ▼
proof + 9 public signals ──► local groth16.verify(vk) in the same browser tab
      │
      ▼
nullifier = SHA256(localSecret : "TRIAL-001")
```

The circuit's 9 public signals are `minAge, maxAge, minBiomarker,
maxBiomarker, requiredMedicationX, requiredCountryCode, forbiddenPregnant,
forbiddenConditionY, trialId`. They are the trial's eligibility criteria — all
already public in `trials/trial-001.json` — and bind the proof to one specific
trial configuration so it cannot be replayed against another.

## Blockchain flow

1. Participant generates and verifies a Groth16 proof locally.
2. Participant clicks **Connect Stellar wallet** → Freighter returns a public
   key.
3. App loads the signer account from the network, builds a
   `record_enrollment` invocation, and **simulates** it to obtain the Soroban
   resource footprint and auth.
4. App calls `prepareTransaction` to attach the simulated footprint.
5. Wallet signs the transaction XDR.
6. App submits the signed transaction and polls until it is **confirmed** in a
   ledger.
7. The enrollment counter is read back from contract storage.
8. The sponsor dashboard reads the counter from the same contract storage.

Implementation: [`lib/chain/soroban.ts`](./lib/chain/soroban.ts) (build →
simulate → prepare → submit → confirm → read back) and
[`lib/chain/wallet.ts`](./lib/chain/wallet.ts) (Freighter connector, no
wrapper dependency).

**The UI never claims success without a confirmed transaction.** If there is no
wallet, the wallet rejects, simulation fails, or the transaction fails, the app
displays **"Blockchain enrollment failed"** with the real error, or **"Connect
your Stellar wallet to enroll"** when no wallet is present.

## AI matching

`lib/trial/matching.ts` implements **"AI-assisted trial discovery"**: local,
deterministic, weighted feature matching that suggests which trials might be
worth checking. It requires **no API key**, sends nothing off-device, and
**never decides eligibility** — that decision is made exclusively by the ZK
circuit. See `docs/ARCHITECTURE.md` for why this separation matters.

## Smart contract

`contracts/zk_trial` (Rust / Soroban, `soroban-sdk 22`) stores:

- `trial_id` (Soroban `Symbol`, e.g. `TRIAL001`)
- `config_hash` (`BytesN<32>`, SHA-256 of `trials/trial-001.json`)
- `enrollment_count` (`u32`)
- `nullifiers` (`Map<BytesN<32>, u64>`, timestamp per anonymous enrollment)
- `active` flag and an `admin` address

It stores **no medical information of any kind** and performs **no ZK proof
verification**. 8 Rust unit tests cover initialization, duplicate rejection,
cross-trial nullifier isolation, and authorization
(`contracts/zk_trial/src/test.rs`).

Contract functions:

| Function | Auth | Purpose |
|---|---|---|
| `init_admin(admin)` | one-time | sets the admin who may register trials |
| `initialize_trial(admin, trial_id, config_hash)` | admin | registers a trial with a criteria commitment |
| `record_enrollment(trial_id, nullifier)` | none | increments the counter; rejects a reused nullifier |
| `get_enrollment_count(trial_id)` | view | current count |
| `get_trial(trial_id)` | view | full trial metadata |
| `has_enrolled(trial_id, nullifier)` | view | duplicate check |

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14.2 (App Router), React 18.3, TypeScript 5.6, Tailwind 3.4 |
| ZK | Circom 2.1.9, snarkjs 0.7.5 (Groth16 / BN128) |
| Blockchain | Stellar / Soroban — `soroban-sdk` 22, Rust |
| Chain client | `@stellar/stellar-sdk` 12.3 (`SorobanRpc`, `prepareTransaction`, `getContractData`) |
| Wallet | Freighter browser extension (direct `window.freighter` API, no wrapper) |
| Tests | Node built-in test runner (`node --test`), `cargo test` |
| CI | GitHub Actions |

## Local setup

### Prerequisites

- Node.js ≥ 20 and npm ≥ 10
- The [Freighter](https://www.freighter.app) browser extension on **Testnet**
  network, funded with test XLM (only needed to submit a real transaction)
- Rust + `rustup target add wasm32v1-none` and the
  [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
  — only needed to rebuild/redeploy the contract
- `circom` 2.1.9 — only needed to recompile the circuit (compiled artifacts are
  already committed under `circuits/eligibility/build/`)

### Installation

```bash
npm ci
```

### Configuration

```bash
cp .env.example apps/web/.env.local
```

`.env.example` is already filled in with the real deployed contract ID. All
variables are `NEXT_PUBLIC_*` and are public by design.

**Where a secret would go: nowhere.** This project has no server-side signer.
Signing is performed exclusively by the participant's own Freighter wallet
through the browser extension. There is no `PRIVATE_KEY`, `SEED`, `MNEMONIC`,
or `API_KEY` anywhere in this repository, and none is required to run or deploy
it. Deployment secrets (the Stellar deployer identity) live **only** in your own
local `~/.config/stellar/identity/` directory, managed by `stellar keys`, and are
never committed.

### Running the frontend

```bash
npm run dev
# open http://localhost:3000
```

### Generating and verifying a proof from the command line

```bash
cd circuits/eligibility
node build/eligibility_js/generate_witness.js \
  build/eligibility_js/eligibility.wasm test/input-valid.json ../../witness-valid.wtns
cd ../..
npx snarkjs groth16 prove \
  circuits/eligibility/build/eligibility_final.zkey \
  witness-valid.wtns \
  circuits/eligibility/test/proof-valid.json \
  circuits/eligibility/test/public-valid.json
npx snarkjs groth16 verify \
  circuits/eligibility/build/verification_key.json \
  circuits/eligibility/test/public-valid.json \
  circuits/eligibility/test/proof-valid.json
# -> OK!
```

### Compiling the circuit (optional — artifacts are pre-built and committed)

```bash
git clone https://github.com/iden3/circom.git
cd circom && cargo build --release && cargo install --path circom && cd ..
npm run zk:compile
npm run zk:setup
```

## Testing

```bash
npm ci
npm run zk:test        # 17 tests: ZK circuit + lib (Node test runner)
npm run contract:test  # 8 tests: Soroban contract (cargo test)
npm test               # both of the above
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run build          # production Next.js build
npm run check:files    # asserts every submission-required file exists
```

The ZK suite covers, against the real committed `.wasm` / `.zkey`:

- a valid synthetic patient produces a proof that verifies
- `age = 72` (too high) cannot produce a proof
- `age = 10` (too low) cannot produce a proof
- `biomarker = 25` and `95` cannot produce a proof
- `medicationX = false` cannot produce a proof
- wrong `countryCode` cannot produce a proof
- `pregnant = 1` cannot produce a proof
- `conditionY = 1` cannot produce a proof
- changing a private input destroys provability
- a tampered proof fails verification
- tampered public signals fail verification

## Contract deployment

The deployed contract and its transactions are recorded in
[`deployment/preprod.json`](./deployment/preprod.json).

To redeploy from scratch:

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli --features opt   # or: brew install stellar-cli

stellar keys generate zk-trial-deployer
stellar keys fund zk-trial-deployer --network testnet

DEPLOYER_IDENTITY=zk-trial-deployer bash scripts/deploy-preprod.sh
```

The script builds the wasm, deploys it, calls `init_admin`, calls
`initialize_trial` with `SHA256(trials/trial-001.json)`, writes
`deployment/preprod.json`, and writes `apps/web/.env.local`.

## Frontend deployment

`vercel.json` is included so a single-command Vercel deploy works from the repo
root of this monorepo.

```bash
npm i -g vercel
vercel login
vercel --prod
```

The frontend needs no server and no secrets. If the variables in
`.env.example` are kept as-is, the deployed app already points at the deployed
Testnet contract. To point at a different contract, override
`NEXT_PUBLIC_CONTRACT_ID` / `NEXT_PUBLIC_SOROBAN_RPC_URL` /
`NEXT_PUBLIC_NETWORK_PASSPHRASE` in the hosting dashboard.

Any other static/Next.js host works too: `npm run build && npm run start`.

## Demo instructions

1. Open the app, click **Check Eligibility** → you land on **TRIAL-001**.
2. Leave the default synthetic **valid** patient values (age 32, biomarker 61,
   Medication X ✔, India, not pregnant, no Condition Y) and click **Generate my
   eligibility proof**.
3. Watch the real proof pipeline run, then **"Eligibility proven"**.
4. Click **Connect Stellar wallet** → approve in Freighter.
5. Click **Enroll on-chain** → approve the transaction in Freighter.
6. The app shows **"Enrollment confirmed on-chain"** with the real transaction
   hash, the ledger it landed in, and the new on-chain counter.
7. Click **Open sponsor dashboard** → the count increased, read from contract
   storage.
8. Go back, set **Age** to `72` (or tick **Currently pregnant**), and submit
   again → the circuit cannot construct a proof, and you see
   "Eligibility requirements not satisfied" with no criterion revealed.

## Known limitations

- **Proof verification is off-chain.** The contract is the public
  attestation/counter layer; the Groth16 proof is generated and verified in the
  browser. Disclosed here and in `docs/ARCHITECTURE.md`, not hidden.
- **The nullifier is not circuit-bound.** It is a SHA-256 hash of a local secret
  and the trial ID. A more rigorous design constrains nullifier derivation
  inside the circuit (Merkle-membership + nullifier, e.g. Semaphore/Tornado
  style). See [`SECURITY.md`](./SECURITY.md).
- **Clearing browser storage resets the nullifier**, so duplicate-prevention is
  best-effort for this demo, not a hard guarantee.
- **The Groth16 trusted setup is a local, single-contributor demo ceremony**,
  not a multi-party ceremony. The keys exist to make the demo reproducible; the
  toxic-waste property is not claimed.
- **One sample trial** (TRIAL-001) ships, though the schema supports more.
- **The public testnet RPC indexes only a bounded window of contract events**,
  so the sponsor dashboard's "Latest enrollment" transaction link is
  best-effort. The authoritative count always comes from contract storage.

## Future roadmap

- On-chain Groth16 verification so the contract itself checks the proof.
- Circuit-bound nullifiers.
- Multiple trials with a richer discovery UI.
- A production-grade, multi-party trusted setup.
- On-chain, per-enrollment proof hash for third-party auditability.

## Security

See [`SECURITY.md`](./SECURITY.md).

## Level 4 Submission Checklist

| # | Item | Status |
|---|---|---|
| 1 | MVP live on Testnet (contract) | ✅ `CCWXE7V7UU72S4EPCY54WWMQDXLHUTJLC33MXE6IO4KX6IOQAKTRV55F` |
| 2 | Real on-chain enrollment transaction | ✅ `15250c8980ca69da83c4b487f353a6452fabdbddff1541e4e005d3d836fbe11f` |
| 3 | Sponsor counter reads real contract state | ✅ verified live (0 → 1) |
| 4 | Public GitHub repository | ⬜ **MANUAL ACTION REQUIRED** — push this repo |
| 5 | README (setup, usage, architecture, privacy) | ✅ this file |
| 6 | Setup documentation | ✅ [Local setup](#local-setup) |
| 7 | Usage documentation | ✅ [Demo instructions](#demo-instructions) |
| 8 | CI/CD workflow | ✅ `.github/workflows/ci.yml` |
| 9 | Passing CI | ✅ verified locally (`npm ci`, lint, typecheck, 17 ZK tests, 8 contract tests, production build) — **MANUAL ACTION REQUIRED** to confirm the green run on GitHub |
| 10 | Contract address | ✅ see table at the top |
| 11 | Live demo URL | ⬜ **MANUAL ACTION REQUIRED** — `vercel --prod` after `vercel login` |
| 12 | X profile link | ⬜ **MANUAL ACTION REQUIRED** |
| 13 | Demo video | ⬜ **MANUAL ACTION REQUIRED** |
| 14 | 15 meaningful commits | ✅ 15 commits, one per functional area |
| 15 | Security disclaimer | ✅ [`SECURITY.md`](./SECURITY.md) |

## License

[MIT](./LICENSE)
