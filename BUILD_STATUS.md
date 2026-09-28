# BUILD_STATUS.md

A precise record of what was actually built, executed, and verified for this
project, and what still needs a personal account. Nothing here is aspirational:
every ✅ below corresponds to a command that was really run.

## Live deployment

| Item | Value |
|---|---|
| Network | Stellar **Testnet** (`Test SDF Network ; September 2015`) |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Contract ID | `CCWXE7V7UU72S4EPCY54WWMQDXLHUTJLC33MXE6IO4KX6IOQAKTRV55F` |
| Trial registered | `TRIAL001` (display: TRIAL-001) |
| Contract wasm SHA-256 | `7a7e885cb5bbd205198e945bd0683f48ac5124f098da48ff1b3313f9169dbec2` |
| `init_admin` tx | `f8f565943d42bc7742109ad8b141e30262bfb16617705250b676667c7544a2e8` |
| `initialize_trial` tx | `853849194300d932ffd6888c8b50e1659d4851d2e8bcfc0f5f9937ff897de204` |
| `record_enrollment` tx | `15250c8980ca69da83c4b487f353a6452fabdbddff1541e4e005d3d836fbe11f` |

Full record: [`deployment/preprod.json`](./deployment/preprod.json).
Explorer: https://stellar.expert/explorer/testnet

## What was actually run and verified

| Check | Command | Result |
|---|---|---|
| Clean dependency install | `npm ci` | ✅ 471 packages, exit 0 |
| ZK circuit + lib tests (17) | `npm run zk:test` | ✅ `pass 17, fail 0` |
| Soroban contract tests (8) | `npm run contract:test` (`cargo test`) | ✅ `8 passed; 0 failed` |
| Lint | `npm run lint` | ✅ no warnings, no errors |
| Typecheck | `npm run typecheck` | ✅ no errors |
| Production frontend build | `npm run build` | ✅ compiles (see benign warnings below) |
| Contract → wasm | `cargo build --target wasm32v1-none --release` | ✅ `Finished release profile` |
| Contract deploy → Testnet | `stellar contract deploy` | ✅ contract id above |
| `init_admin` on-chain | `stellar contract invoke` | ✅ confirmed, `Success` |
| `initialize_trial` on-chain | `stellar contract invoke` | ✅ confirmed, `trl_init` event emitted |
| `record_enrollment` on-chain | `stellar contract invoke` | ✅ confirmed, `enrolled` event emitted, returned `1` |
| Sponsor dashboard data source | `SorobanRpc.getContractData` against the live contract | ✅ real `enrollment_count` read back from chain state |
| Submission file check | `npm run check:files` | ✅ all required files present |

### ZK behaviour confirmed against the committed artifacts

- Valid synthetic patient (age 32, biomarker 61, Medication X, IN, not pregnant,
  no Condition Y) → proof generated → `groth16.verify` returns `true`.
- `age = 72`, `age = 10`, `biomarker = 25`, `biomarker = 95`,
  `medicationX = 0`, `countryCode = 840`, `pregnant = 1`, `conditionY = 1` →
  **witness generation fails; no proof can be produced.**
- Tampered proof → verification returns `false`.
- Tampered public signals → verification returns `false`.

### Benign frontend build warnings

The production build emits webpack "Critical dependency" warnings from two
transitive dependencies (`sodium-native` inside `@stellar/stellar-sdk`, and
`web-worker` inside `ffjavascript`/`snarkjs`). These are dynamic-`require`
patterns inside third-party code; they do not fail the build and do not affect
runtime behaviour. Documented rather than silently ignored.

## Toolchain decisions worth knowing

- `soroban-sdk` is pinned to **22.x** (the contract was verified against Stellar
  CLI v27 / protocol 23). The lock file pins `ed255-dalek` to 2.2.0, because
  resolving 3.0.0 breaks `soroban-env-host`'s `testutils` feature on current
  rustc. Without that pin, `cargo test` fails to compile.
- The wasm target is `wasm32v1-none`, which is what the current Stellar CLI
  emits.
- The Node test suite runs with `--test-force-exit`, because
  `ffjavascript` leaves worker handles open and the runner would otherwise hang
  after finishing every test.

## Remaining manual actions (for you)

1. **Push to GitHub** — `git remote add origin <url> && git push -u origin main`.
2. **Deploy the frontend** — `vercel login && vercel --prod` from the repo root
   (`vercel.json` is committed and configured for this monorepo), then paste the
   resulting URL into the README table.
3. **X profile link** — add it to the README table.
4. **Demo video** — record the 2-minute script; add the link to the README.
5. **Confirm CI is green** — the workflow is committed and every step was run
   locally with the same commands; the actual GitHub Actions run needs the repo
   to exist.
6. **Re-point the CI badge** — the badge at the top of `README.md` needs your
   `owner/repo` instead of `YOUR_GITHUB_USERNAME`.

## Known limitations

See the "Known limitations" section of `README.md` and the threat model in
`SECURITY.md`. In short: off-chain proof verification (documented, not hidden),
non-circuit-bound nullifier, single-party demo trusted setup, and a bounded
event-index window on the public testnet RPC for the "latest enrollment" row.
