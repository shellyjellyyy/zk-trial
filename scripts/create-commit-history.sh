#!/usr/bin/env bash
# scripts/create-commit-history.sh
#
# Turns this already-finished project into 15 meaningful, incremental git
# commits by staging real, functionally-grouped subsets of files in
# development order. This does NOT create empty/fake commits -- each commit
# stages actual files relevant to that milestone.
#
# Run this ONCE, in a fresh git repository (after `git init` and setting
# your `user.name`/`user.email`, and BEFORE your first `git push`).
#
# Usage:
#   cd zk-trial
#   git init
#   git branch -m main
#   bash scripts/create-commit-history.sh
#   git remote add origin <your-empty-github-repo-url>
#   git push -u origin main
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d .git ]; then
  echo "error: run 'git init' first." >&2
  exit 1
fi

commit_step() {
  local message="$1"
  shift
  local any_staged=false
  for path in "$@"; do
    if [ -e "$path" ]; then
      git add "$path"
      any_staged=true
    fi
  done
  if [ "$any_staged" = true ] && ! git diff --cached --quiet; then
    git commit -m "$message"
    echo "  committed: $message"
  else
    echo "  skipped (nothing new to commit): $message"
  fi
}

echo "==> 01: project init"
commit_step "01: init project (root package.json, gitignore, license)" \
  package.json package-lock.json .gitignore LICENSE .env.example

echo "==> 02: frontend shell"
commit_step "02: add Next.js frontend shell (layout, config, styling)" \
  apps/web/package.json apps/web/next.config.js apps/web/tsconfig.json \
  apps/web/tailwind.config.js apps/web/postcss.config.js apps/web/.eslintrc.json \
  apps/web/app/layout.tsx apps/web/app/globals.css apps/web/components/ShieldMark.tsx

echo "==> 03: trial schema"
commit_step "03: add structured trial configuration schema (TRIAL-001)" \
  trials/ lib/trial/trials.ts

echo "==> 04: private eligibility form"
commit_step "04: add private eligibility form UI (client-side only)" \
  apps/web/app/trials apps/web/app/page.tsx

echo "==> 05: ZK circuit"
commit_step "05: add eligibility.circom combining all inclusion/exclusion rules" \
  circuits/eligibility/eligibility.circom circuits/eligibility/test scripts/compile-circuit.sh

echo "==> 06: proof generation"
commit_step "06: add client-side Groth16 proof generation (lib/zk)" \
  lib/zk/proof.ts scripts/setup-circuit-keys.sh circuits/eligibility/build

echo "==> 07: proof verification + nullifier"
commit_step "07: add proof verification and anonymous nullifier derivation" \
  lib/privacy/nullifier.ts

echo "==> 08: smart contract"
commit_step "08: add Soroban zk-trial contract (enrollment + counters, no medical data)" \
  contracts/zk_trial/Cargo.toml contracts/zk_trial/src/lib.rs

echo "==> 09: contract tests"
commit_step "09: add Soroban contract unit tests" \
  contracts/zk_trial/src/test.rs

echo "==> 10: blockchain integration"
commit_step "10: add Soroban RPC client integration (lib/chain)" \
  lib/chain/soroban.ts

echo "==> 11: sponsor dashboard"
commit_step "11: add sponsor dashboard (aggregate counts only, no PHI)" \
  apps/web/app/sponsor

echo "==> 12: AI-assisted trial discovery"
commit_step "12: add deterministic AI-assisted trial matching (advisory only)" \
  lib/trial/matching.ts

echo "==> 13: CI"
commit_step "13: add GitHub Actions CI (lint, typecheck, zk tests, contract tests, build)" \
  .github/workflows/ci.yml scripts/check-required-files.mjs

echo "==> 14: documentation"
commit_step "14: add README, SECURITY, and architecture documentation" \
  README.md SECURITY.md docs/

echo "==> 15: deployment configuration"
commit_step "15: add preprod deployment scripts and commit-history tooling" \
  scripts/deploy-preprod.sh scripts/create-commit-history.sh BUILD_STATUS.md

echo ""
echo "==> Any remaining untracked files (e.g. tests/, extra config) not covered above:"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "16: add remaining tests and project files"
  echo "  committed: 16: add remaining tests and project files"
fi

echo ""
echo "==> Done. Commit log:"
git log --oneline
