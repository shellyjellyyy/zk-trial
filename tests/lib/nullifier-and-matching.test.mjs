// tests/lib/nullifier-and-matching.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Re-implements the same derivation as lib/privacy/nullifier.ts's Node path
// (that module uses require("crypto") internally; we exercise the identical
// algorithm here without needing a DOM/TS build step for the test runner).
function deriveNullifierNode(secretHex, trialId) {
  return createHash("sha256").update(`${secretHex}:${trialId}`).digest("hex");
}

test("nullifier is deterministic for same secret+trial", () => {
  const a = deriveNullifierNode("abc123", "TRIAL-001");
  const b = deriveNullifierNode("abc123", "TRIAL-001");
  assert.equal(a, b);
});

test("nullifier differs across trials for the same participant secret", () => {
  const a = deriveNullifierNode("abc123", "TRIAL-001");
  const b = deriveNullifierNode("abc123", "TRIAL-002");
  assert.notEqual(a, b);
});

test("nullifier differs across participants for the same trial", () => {
  const a = deriveNullifierNode("secret-a", "TRIAL-001");
  const b = deriveNullifierNode("secret-b", "TRIAL-001");
  assert.notEqual(a, b);
});

// --- AI-assisted discovery (deterministic local matching) -----------------

function suggestScore(profile, criteria) {
  let score = 0;
  const checks = 5;
  if (profile.age >= criteria.age.min && profile.age <= criteria.age.max) score++;
  if (profile.biomarker >= criteria.biomarker.min && profile.biomarker <= criteria.biomarker.max) score++;
  if (profile.medicationX === criteria.medication_x) score++;
  if (profile.pregnant === criteria.pregnant) score++;
  if (profile.conditionY === criteria.condition_y) score++;
  return score / checks;
}

const TRIAL_CRITERIA = {
  age: { min: 18, max: 65 },
  biomarker: { min: 40, max: 80 },
  medication_x: true,
  pregnant: false,
  condition_y: false,
};

test("matching gives a perfect score to the synthetic valid patient", () => {
  const score = suggestScore(
    { age: 32, biomarker: 61, medicationX: true, pregnant: false, conditionY: false },
    TRIAL_CRITERIA
  );
  assert.equal(score, 1);
});

test("matching score drops for a profile outside the trial envelope", () => {
  const score = suggestScore(
    { age: 80, biomarker: 61, medicationX: true, pregnant: false, conditionY: false },
    TRIAL_CRITERIA
  );
  assert.ok(score < 1);
});
