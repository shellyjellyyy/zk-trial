#!/usr/bin/env bash
# scripts/compile-circuit.sh
#
# Recompiles circuits/eligibility/eligibility.circom. Requires the `circom`
# 2.1.9 compiler on PATH (https://docs.circom.io/getting-started/installation/).
#
# Usage: bash scripts/compile-circuit.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v circom >/dev/null 2>&1; then
  echo "error: circom not found on PATH." >&2
  echo "Install it (see https://docs.circom.io/getting-started/installation/) e.g.:" >&2
  echo "  git clone https://github.com/iden3/circom.git && cd circom && cargo build --release && cargo install --path circom" >&2
  exit 1
fi

echo "==> circom version:"
circom --version

mkdir -p circuits/eligibility/build

circom circuits/eligibility/eligibility.circom \
  --r1cs --wasm --sym \
  -l node_modules/circomlib/circuits \
  -o circuits/eligibility/build

echo "==> Compiled. Artifacts in circuits/eligibility/build/"
echo "==> Next: bash scripts/setup-circuit-keys.sh"
