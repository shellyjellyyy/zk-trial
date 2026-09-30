# Evidence Screenshot Checklist

**Status:** the four core shots — #1 landing, #2 eligibility form (with 1AM
Wallet connected), #4 enrollment confirmation, #6 sponsor dashboard — have
been captured for the submission. The remaining shots are optional extras;
if you want them referenced from the README, commit them under
`docs/screenshots/` with the file names below.

Capture order matches the Rise In submission flow. Save as PNG, name them as
below, and redact where indicated before uploading anywhere public.

General rules:

- Use **synthetic values only** in any form field visible on screen.
- Redact your own wallet address and balances unless the shot requires them.
- The contract address (`dfdd2440…ced3`) and tx id may stay visible — they are
  public and are the point of the evidence.

| # | File name | Shot | What it proves | Must be visible | Redact / avoid |
|---|---|---|---|---|---|
| 1 | `01-landing.png` | Landing page of the live deployment | The demo is live on Vercel and is the real app | URL bar showing `zk-trial-kaiqa94aj-shailja-srivastav.vercel.app`; hero + trial card | browser bookmarks bar, personal tabs |
| 2 | `02-eligibility-form.png` | Eligibility form on `/trials/TRIAL-001` with synthetic values filled | The six private inputs are collected browser-side | All six fields filled with **synthetic** values; criteria card above | real health data; any personal info |
| 3 | `03-wallet-connected.png` | 1AM Wallet connected state | Real 1AM Wallet integration over the DApp Connector | "1AM Wallet connected" state in the app (and the 1AM popup if convenient); Preprod network label | wallet address, balances, recovery-phrase screens (never) |
| 4 | `04-enrollment-confirmation.png` | Confirmed enrollment card | End-to-end enrollment succeeded | Confirmed card: anonymous ID (nullifier), tx id, block height, enrollment count | none required — nullifier is pseudonymous; keep as-is |
| 5 | `05-tx-block-height.png` | Zoom on transaction id + block height | A real finalized Preprod transaction | Full tx id `00f78951…bb18` and the block height figure | nothing else in frame |
| 6 | `06-sponsor-dashboard.png` | `/sponsor` | Sponsor reads live public state without a wallet | Verified enrollments count (the live on-chain value), contract/indexer rows, the "what the sponsor can/cannot see" panel | your wallet must NOT be connected for this shot — that is the point |
| 7 | `07-github-repo.png` | GitHub repo main page | Public repository, clean history | Repo name `shellyjellyyy/zk-trial`, public badge, latest commit | personal GitHub dashboards/notifications |
| 8 | `08-github-actions.png` | Actions tab, latest green run on `main` | CI green: compile+artifact-diff, tests, typecheck, lint, build | The green check on `main`, workflow name, step list | none |
| 9 | `09-readme.png` | README rendered on GitHub | Submission-quality docs with real values | Header table (live demo, contract, network, wallet) and the privacy-model table | none |
| 10 | `10-vercel.png` | Vercel project page or deployment detail | The deployment is real and tied to the repo | Project name, production deployment READY, recent deployment time | account email, team names, other projects, env var values panel |

## Shot-by-shot notes

1. **Landing** — full viewport at 1080p+, no zoom; the URL must be legible.
2. **Form** — fill exactly as the demo script suggests (age 34, biomarker 62,
   Medication X ✓, India, both exclusions unticked). If you already enrolled
   with those values, change a digit so the screenshot isn't a second
   enrollment.
3. **Wallet** — if the 1AM popup covers the app, take two shots and keep the
   better one; the app's connected chip is sufficient by itself.
4. **Confirmation** — capture before navigating away; the block-height row is
   the one reviewers zoom into.
5. **Tx + height** — crop tightly; this pairs with the README's documented tx.
6. **Sponsor dashboard** — do this in a fresh/incognito window *without* the
   wallet connected to prove the read path is wallet-free.
7–9. **GitHub** — light or dark theme, just keep text legible; the Actions
   run should be the most recent commit on `main`.
10. **Vercel** — the deployment list view is enough; do not open Environment
    Variables settings in the shot.

## Already covered without screenshots

- Contract address: documented in README/PROPOSAL/SECURITY and the submission
  commit message.
- Test counts: CI run page (`08`) shows the suite; README documents 37/37.
- Commit count: `git rev-list --count HEAD` → 18.
