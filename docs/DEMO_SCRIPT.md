# Demo Video Script — 2:40–3:00 minutes

Recording setup: Chrome with the **1AM Wallet extension installed and on
Midnight Preprod**, screen recorder at 1080p, browser zoomed to ~110%,
Tabs pre-opened:

1. Live app (participant view): https://zk-trial-kaiqa94aj-shailja-srivastav.vercel.app
2. Sponsor dashboard: https://zk-trial-kaiqa94aj-shailja-srivastav.vercel.app/sponsor
3. GitHub repo: https://github.com/shellyjellyyy/zk-trial

Use **synthetic values** for the enrollment demo. If you prefer not to burn a
live enrollment on camera, the confirmation segment can use your existing
result from the already-performed enrollment (tx
`00f78951dd1250f4e0559ac80a7d49c5d7b8f7a445548028dab59e6c60bd02bb18`) — but a
live proof-and-approve flow is stronger evidence.

---

## 0:00–0:20 — Problem (voiceover, show the trial page)

**On screen:** open the landing page, then click into **Trials → TRIAL-001**.
Let the criteria card fill the frame.

**Say:** "Clinical trials need to check things like age, biomarkers,
medications, and health conditions — the most sensitive data a person has.
Today you hand all of it to a sponsor just to learn whether you qualify.
What if you could prove you qualify without revealing a single value?"

**Do:** highlight the six criteria on the card with the cursor.

## 0:20–0:50 — Private eligibility inputs

**On screen:** scroll to the enrollment form on the same page.

**Say:** "This is zk-trial. The participant enters their health profile here,
in their own browser. These six values — age, biomarker level, medication,
country, pregnancy status, and a condition flag — become the private inputs
of a zero-knowledge proof. They are never sent to any server, never logged,
and never appear on-chain."

**Do:** enter synthetic values that clearly pass — for example age `34`,
biomarker `62`, Medication X checked, country India, both exclusions
unticked. Hover the small print under the form stating the values are
synthetic and private.

## 0:50–1:10 — 1AM Wallet + Midnight Preprod

**On screen:** click **Connect 1AM Wallet and enroll**. The 1AM Wallet popup
appears — show the connection request, then the Preprod network indicator.

**Say:** "The app talks to Midnight Preprod through Midnight.js, and the
participant's own 1AM Wallet does the signing. There is no server-side key
anywhere in this project — the wallet is the signer. Proving and fees are
sponsored by 1AM's ProofStation, so no tokens are needed to try it."

**Do:** approve the connection in 1AM. If the wallet shows the network,
let it stay visible for a second.

## 1:10–1:40 — Enrollment transaction

**On screen:** back in the app, the status panel walks the real pipeline:
*Generating privacy proof… → Waiting for wallet approval… → Submitting to
Midnight Preprod…*. When the 1AM approval popup appears for the transaction,
show it.

**Say:** "The Compact circuit asserts every criterion inside the proof
itself — an ineligible profile can't even construct a proof. The circuit
derives an anonymous, trial-scoped nullifier from my private seed and returns
it as the proof's public output. The wallet balances the transaction and
relays it to Midnight Preprod."

**Do:** approve the transaction in the wallet. Do not skip this approval on
camera.

## 1:40–2:00 — Enrollment confirmation

**On screen:** the confirmed card in the app.

**Say:** "Finalized. The UI shows the real transaction id, the block height,
my anonymous ID — that 32-byte nullifier is the *only* thing about me on the
ledger — and the public enrollment count, read straight from contract state."

**Do:** highlight, in order: **Transaction id**, **Block height**,
**Anonymous ID (nullifier)**, **Public enrollment count**.

## 2:00–2:20 — Sponsor dashboard

**On screen:** open the second tab — `/sponsor`.

**Say:** "The sponsor's view reads live chain state through the Preprod
indexer — no wallet, read-only. They see the verified enrollment count and
the anonymous nullifier set. What they can never see: age, biomarker,
medication status, country, pregnancy, condition — or who any participant
is."

**Do:** point at the count, then scroll to the panel that lists exactly what
is and isn't visible to the sponsor.

## 2:20–2:40 — Architecture / privacy explanation

**On screen:** GitHub repo, `README.md` — scroll to the Architecture section.

**Say:** "Under the hood: a Compact contract on Midnight holds a public
counter and a set of used nullifiers — that's the entire public state. The
eligibility rules are asserts inside the circuit, so the proof system itself
enforces them. Midnight.js drives the full lifecycle — build, prove, balance,
submit, finalize — from the browser."

**Do:** scroll through the architecture diagram and the privacy-model table.

## 2:40–3:00 — GitHub / live demo / closing

**On screen:** repo main page, then back to the live app for a final frame.

**Say:** "Everything is open source — the contract, the tests, the CI that
recompiles the circuit and fails on any artifact drift. Thirty-seven tests,
typecheck, lint, and a production build, all green. The live demo is running
on Vercel against a real deployment on Midnight Preprod. This is zk-trial —
private eligibility for clinical trials. Thanks for watching."

**Do:** end on the repo page or the app's confirmation card.

---

## Recording checklist

- [ ] 1AM Wallet connected to **preprod** before recording
- [ ] Synthetic values only — never real health data on camera
- [ ] The full pipeline statuses visible (do not cut the wallet approvals)
- [ ] Transaction id + block height clearly readable in frame
- [ ] Sponsor dashboard count visible (the live on-chain value)
- [ ] Final frame: GitHub repo or the confirmation card
- [ ] Total length under 3:00
