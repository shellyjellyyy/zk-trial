# Evidence Screenshot Checklist

Four screenshots are committed under [`docs/screenshots/`](./screenshots/) and
are referenced from the top-level [`README.md`](../README.md).

| # | File name | State shown | What it demonstrates |
|---|---|---|---|
| 1 | [`01-landing.png`](./screenshots/01-landing.png) | Landing page | The app is deployed and publicly reachable at `https://zk-trial-qin0ddun1-shailja-srivastav.vercel.app/`. Hero, trial card, and the Live Demo / Demo Video links are visible. |
| 2 | [`02-eligibility-wallet.png`](./screenshots/02-eligibility-wallet.png) | Eligibility form with 1AM Wallet connected | The participant's synthetic values are entered in the browser, the six criteria are shown, and the wallet is connected over the DApp Connector before any proof is generated. |
| 3 | [`03-enrollment-confirmed.png`](./screenshots/03-enrollment-confirmed.png) | Confirmed enrollment | A completed end-to-end enrollment: the anonymous nullifier, the real transaction id, the block height, and the public enrollment count read back from chain state. |
| 4 | [`04-sponsor-dashboard.png`](./screenshots/04-sponsor-dashboard.png) | Sponsor dashboard | The sponsor's wallet-free read-only view: network, contract address, indexer endpoint, and the live verified-enrollment counter. |

## General rules

- Use **synthetic values only** in any visible form field.
- Redact personal wallet addresses and balances unless the shot requires them.
- The contract address
  (`dfdd24401b50b93356cb0e4f16d85c9626642d586d634c328bb0d978e759ced3`) and the
  transaction id may stay visible — both are public by design and are the point
  of the evidence.
- Never capture a recovery phrase, seed phrase, or any private key.

## Already covered without screenshots

- **Contract address** — recorded in `README.md`, `PROPOSAL.md`, `SECURITY.md`,
  and `contracts/zk-trial.compact`.
- **Test counts** — the CI run page shows the suite; `README.md` documents 37/37.
- **Commit count** — `git rev-list --count HEAD`.
