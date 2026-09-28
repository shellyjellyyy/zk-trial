#!/usr/bin/env bash
# scripts/deploy-preprod.sh
#
# Builds and deploys contracts/zk_trial to Stellar Testnet (the public
# Soroban network used for this submission) with the official `stellar` CLI,
# then initializes the contract and TRIAL-001, and writes the resulting
# contract address to deployment/preprod.json plus apps/web/.env.local.
#
# WHAT THIS SCRIPT DOES NOT DO:
#   - It does not embed, generate, print, or transmit any private key. It uses
#     whatever identity you already configured with `stellar keys`.
#   - It does not fund your account. Fund it yourself via Friendbot (see below).
#
# Prerequisites:
#   1. Stellar CLI (tested with v27):
#        cargo install --locked stellar-cli --features opt
#   2. rustup target add wasm32v1-none
#   3. stellar keys generate zk-trial-deployer
#      then fund it:  stellar keys fund zk-trial-deployer --network testnet
#
# Usage:
#   DEPLOYER_IDENTITY=zk-trial-deployer bash scripts/deploy-preprod.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NETWORK="${STELLAR_NETWORK:-testnet}"
DEPLOYER_IDENTITY="${DEPLOYER_IDENTITY:-zktrial-dep}"
TRIAL_ID="${TRIAL_ID:-TRIAL001}"

if ! command -v stellar >/dev/null 2>&1; then
  echo "error: 'stellar' CLI not found. Install it first:" >&2
  echo "  cargo install --locked stellar-cli --features opt" >&2
  exit 1
fi

echo "==> Building contract (cargo build --target wasm32v1-none --release)"
cd contracts/zk_trial
cargo build --target wasm32v1-none --release
cd "$ROOT_DIR"

WASM_PATH="contracts/zk_trial/target/wasm32v1-none/release/zk_trial_contract.wasm"
if [ ! -f "$WASM_PATH" ]; then
  ALT_PATH="contracts/zk_trial/target/wasm32-unknown-unknown/release/zk_trial_contract.wasm"
  if [ -f "$ALT_PATH" ]; then
    WASM_PATH="$ALT_PATH"
  else
    echo "error: expected wasm not found at $WASM_PATH or $ALT_PATH" >&2
    exit 1
  fi
fi
echo "    wasm: $WASM_PATH"

ADMIN_ADDRESS="$(stellar keys address "$DEPLOYER_IDENTITY")"

echo "==> Deploying to network: $NETWORK using identity: $DEPLOYER_IDENTITY"
DEPLOY_OUT="$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$DEPLOYER_IDENTITY" \
  --network "$NETWORK" 2>&1)"
echo "$DEPLOY_OUT"
CONTRACT_ID="$(printf '%s\n' "$DEPLOY_OUT" | grep -oE 'C[0-9A-Z]{55}' | head -n1)"
if [ -z "$CONTRACT_ID" ]; then
  echo "error: could not parse a contract id from the deploy output" >&2
  exit 1
fi
echo "==> Deployed contract: $CONTRACT_ID"

echo "==> Initializing admin"
stellar contract invoke --id "$CONTRACT_ID" --source-account "$DEPLOYER_IDENTITY" \
  --network "$NETWORK" --no-cache -- init_admin --admin "$ADMIN_ADDRESS" || true

# sha256 is a simple, auditable, reproducible commitment to the off-chain trial
# JSON that the circuit's public signals are derived from.
CONFIG_HASH_HEX="$(sha256sum trials/trial-001.json | cut -d' ' -f1)"

echo "==> Initializing trial $TRIAL_ID with config hash $CONFIG_HASH_HEX"
stellar contract invoke --id "$CONTRACT_ID" --source-account "$DEPLOYER_IDENTITY" \
  --network "$NETWORK" --no-cache -- initialize_trial \
  --admin "$ADMIN_ADDRESS" \
  --trial_id "$TRIAL_ID" \
  --config_hash "$CONFIG_HASH_HEX" || true

mkdir -p deployment
cat > deployment/preprod.json << EOF
{
  "network": "$NETWORK",
  "contractId": "$CONTRACT_ID",
  "adminAddress": "$ADMIN_ADDRESS",
  "trialId": "$TRIAL_ID",
  "trialConfigHash": "$CONFIG_HASH_HEX",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

RPC_URL="https://soroban-testnet.stellar.org"
PASSPHRASE="Test SDF Network ; September 2015"
if [ "$NETWORK" != "testnet" ]; then
  echo "note: NETWORK=$NETWORK is not 'testnet' -- update apps/web/.env.local RPC URL/passphrase manually." >&2
  RPC_URL=""
  PASSPHRASE=""
fi

if [ -n "$RPC_URL" ]; then
  mkdir -p apps/web
  cat > apps/web/.env.local << EOF
NEXT_PUBLIC_SOROBAN_RPC_URL=$RPC_URL
NEXT_PUBLIC_NETWORK_PASSPHRASE=$PASSPHRASE
NEXT_PUBLIC_NETWORK_LABEL=Stellar Testnet
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
EOF
fi

echo ""
echo "==> Deployment complete."
echo "    Contract ID: $CONTRACT_ID"
echo "    Details saved to deployment/preprod.json"
echo "    Frontend env written to apps/web/.env.local"
echo "    Next: npm run build --workspace apps/web && npm run start --workspace apps/web"
