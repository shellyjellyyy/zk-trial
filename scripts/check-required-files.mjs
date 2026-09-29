#!/usr/bin/env node
// scripts/check-required-files.mjs
// Fails CI if any file required for a Level 4 submission is missing.
// Updated for the Midnight/Compact/1AM architecture.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  // Submission docs
  "README.md",
  "SECURITY.md",
  "PROPOSAL.md",
  "LICENSE",
  ".env.example",
  "vercel.json",
  "package.json",
  ".github/workflows/ci.yml",
  "docs/USAGE.md",
  "docs/ARCHITECTURE.md",
  // Compact contract + committed artifacts
  "contracts/zk-trial.compact",
  "managed/zk-trial/compiler/contract-info.json",
  "managed/zk-trial/contract/index.js",
  "managed/zk-trial/contract/index.d.ts",
  "managed/zk-trial/keys/enroll.prover",
  "managed/zk-trial/keys/enroll.verifier",
  "managed/zk-trial/zkir/enroll.bzkir",
  // Contract tests
  "tests/zk-trial.test.ts",
  // Midnight.js + 1AM integration
  "src/midnight/config.ts",
  "src/midnight/wallet.ts",
  "src/midnight/providers.ts",
  "src/midnight/contract.ts",
  "src/midnight/contract-api.ts",
  "src/hooks/useMidnight.ts",
  "src/components/WalletConnect.tsx",
  "src/components/TrialEligibility.tsx",
  "src/components/ContractDeploy.tsx",
  "src/utils/contract.ts",
  "src/witnesses.ts",
  // App pages
  "src/app/page.tsx",
  "src/app/sponsor/page.tsx",
  "src/app/trials/[trialId]/page.tsx",
  // Trial config + tooling
  "trials/trial-001.json",
  "scripts/copy-zk-assets.mjs",
];

// The legacy Stellar/Circom architecture must stay removed.
const FORBIDDEN = [
  "circuits/",
  "contracts/zk_trial/",
  "lib/chain/soroban.ts",
  "lib/chain/wallet.ts",
  "lib/zk/proof.ts",
  "apps/web/",
];

let missing = [];
for (const rel of REQUIRED) {
  if (!fs.existsSync(path.join(ROOT, rel))) missing.push(rel);
}

let present = [];
for (const rel of FORBIDDEN) {
  if (fs.existsSync(path.join(ROOT, rel))) present.push(rel);
}

let failed = false;
if (missing.length > 0) {
  failed = true;
  console.error("Missing required files:");
  for (const m of missing) console.error(`  - ${m}`);
}
if (present.length > 0) {
  failed = true;
  console.error("Legacy Stellar/Circom files must stay removed:");
  for (const p of present) console.error(`  - ${p}`);
}

if (failed) process.exit(1);

console.log(`All ${REQUIRED.length} required files present; legacy files absent.`);
