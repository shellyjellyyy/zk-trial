#!/usr/bin/env node
// scripts/check-required-files.mjs
// Fails CI if any file required for a Level 4 submission is missing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "README.md",
  "SECURITY.md",
  "LICENSE",
  "BUILD_STATUS.md",
  ".env.example",
  "vercel.json",
  "package.json",
  ".github/workflows/ci.yml",
  "circuits/eligibility/eligibility.circom",
  "circuits/eligibility/build/eligibility.r1cs",
  "circuits/eligibility/build/verification_key.json",
  "circuits/eligibility/build/eligibility_final.zkey",
  "circuits/eligibility/build/eligibility_js/eligibility.wasm",
  "apps/web/public/circuits/eligibility/eligibility.wasm",
  "apps/web/public/circuits/eligibility/eligibility.zkey",
  "apps/web/public/circuits/eligibility/verification_key.json",
  "contracts/zk_trial/Cargo.toml",
  "contracts/zk_trial/Cargo.lock",
  "contracts/zk_trial/src/lib.rs",
  "contracts/zk_trial/src/test.rs",
  "deployment/preprod.json",
  "trials/trial-001.json",
  "lib/zk/proof.ts",
  "lib/privacy/nullifier.ts",
  "lib/chain/soroban.ts",
  "lib/chain/wallet.ts",
  "lib/trial/trials.ts",
  "lib/trial/matching.ts",
  "apps/web/app/page.tsx",
  "apps/web/app/sponsor/page.tsx",
  "apps/web/components/EligibilityFlow.tsx",
  "scripts/deploy-preprod.sh",
  "scripts/create-commit-history.sh",
];

let missing = [];
for (const rel of REQUIRED) {
  if (!fs.existsSync(path.join(ROOT, rel))) missing.push(rel);
}

if (missing.length > 0) {
  console.error("Missing required files:");
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(`All ${REQUIRED.length} required files present.`);
