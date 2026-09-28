#!/usr/bin/env bash
# scripts/setup-circuit-keys.sh
#
# Runs a LOCAL, DEMO-GRADE Groth16 trusted setup (powers-of-tau + zkey) for
# the eligibility circuit, and copies the resulting wasm/zkey/verification
# key into apps/web/public/circuits/eligibility/ for client-side proving.
#
# This is NOT a production/multi-party ceremony. See SECURITY.md for the
# limitations of a single-contributor local ceremony.
#
# Usage: bash scripts/setup-circuit-keys.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUILD=circuits/eligibility/build
if [ ! -f "$BUILD/eligibility.r1cs" ]; then
  echo "error: circuit not compiled yet. Run scripts/compile-circuit.sh first." >&2
  exit 1
fi

echo "==> Powers of tau (local demo ceremony, bn128, 2^12 constraints max)"
npx snarkjs powersoftau new bn128 12 "$BUILD/pot12_0000.ptau" -v
npx snarkjs powersoftau contribute "$BUILD/pot12_0000.ptau" "$BUILD/pot12_0001.ptau" \
  --name="zk-trial demo contribution" -v -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs powersoftau prepare phase2 "$BUILD/pot12_0001.ptau" "$BUILD/pot12_final.ptau" -v

echo "==> Groth16 setup"
npx snarkjs groth16 setup "$BUILD/eligibility.r1cs" "$BUILD/pot12_final.ptau" "$BUILD/eligibility_0000.zkey"
npx snarkjs zkey contribute "$BUILD/eligibility_0000.zkey" "$BUILD/eligibility_final.zkey" \
  --name="zk-trial demo key contribution" -v -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey "$BUILD/eligibility_final.zkey" "$BUILD/verification_key.json"

echo "==> Copying artifacts into apps/web/public/circuits/eligibility/"
mkdir -p apps/web/public/circuits/eligibility
cp "$BUILD/eligibility_js/eligibility.wasm" apps/web/public/circuits/eligibility/
cp "$BUILD/eligibility_final.zkey" apps/web/public/circuits/eligibility/eligibility.zkey
cp "$BUILD/verification_key.json" apps/web/public/circuits/eligibility/

echo "==> Done. Run 'npm run zk:test' to exercise valid/invalid proof generation."
