// tests/zk/eligibility.test.mjs
//
// Exercises the compiled eligibility circuit exactly the way the frontend
// does (via snarkjs, against the real .wasm/.zkey artifacts checked into
// circuits/eligibility/build/). Run with: node --test tests/zk/*.test.mjs
//
// Covers requirement #21 from the project spec: valid proof, each
// individual invalid predicate, altered proof, altered public input,
// and "changing a private input invalidates the proof".

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import * as snarkjs from "snarkjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const BUILD = path.join(ROOT, "circuits/eligibility/build");
const WASM = path.join(BUILD, "eligibility_js/eligibility.wasm");
const ZKEY = path.join(BUILD, "eligibility_final.zkey");
const VKEY = JSON.parse(fs.readFileSync(path.join(BUILD, "verification_key.json"), "utf8"));

const VALID_PATIENT = {
  age: 32,
  biomarker: 61,
  medicationX: 1,
  countryCode: 356,
  pregnant: 0,
  conditionY: 0,
  salt: 123456789,
  minAge: 18,
  maxAge: 65,
  minBiomarker: 40,
  maxBiomarker: 80,
  requiredMedicationX: 1,
  requiredCountryCode: 356,
  forbiddenPregnant: 1,
  forbiddenConditionY: 1,
  trialId: 1,
};

async function proveOrFail(inputs) {
  return snarkjs.groth16.fullProve(inputs, WASM, ZKEY);
}

test("valid synthetic patient produces a proof that verifies", async () => {
  const { proof, publicSignals } = await proveOrFail(VALID_PATIENT);
  const ok = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
  assert.equal(ok, true);
});

const invalidCases = [
  ["age too high (72 > 65)", { ...VALID_PATIENT, age: 72 }],
  ["age too low (10 < 18)", { ...VALID_PATIENT, age: 10 }],
  ["biomarker too low (25 < 40)", { ...VALID_PATIENT, biomarker: 25 }],
  ["biomarker too high (95 > 80)", { ...VALID_PATIENT, biomarker: 95 }],
  ["not on medication_x", { ...VALID_PATIENT, medicationX: 0 }],
  ["wrong country", { ...VALID_PATIENT, countryCode: 840 }],
  ["pregnant (exclusion)", { ...VALID_PATIENT, pregnant: 1 }],
  ["has condition_y (exclusion)", { ...VALID_PATIENT, conditionY: 1 }],
];

for (const [label, inputs] of invalidCases) {
  test(`ineligible patient (${label}) CANNOT produce a proof`, async () => {
    await assert.rejects(() => proveOrFail(inputs));
  });
}

test("changing a private input (age) invalidates the ability to prove eligibility", async () => {
  // The valid patient proves fine...
  const { proof, publicSignals } = await proveOrFail(VALID_PATIENT);
  assert.equal(await snarkjs.groth16.verify(VKEY, publicSignals, proof), true);

  // ...but the same profile with only `age` changed to violate the trial's
  // range can no longer produce any proof at all -- the private input
  // directly determines whether a valid witness (and therefore a proof)
  // exists.
  await assert.rejects(() => proveOrFail({ ...VALID_PATIENT, age: 90 }));
});

test("a tampered proof fails verification", async () => {
  const { proof, publicSignals } = await proveOrFail(VALID_PATIENT);
  const tampered = JSON.parse(JSON.stringify(proof));
  tampered.pi_a[0] = (BigInt(tampered.pi_a[0]) + 1n).toString();
  const ok = await snarkjs.groth16.verify(VKEY, publicSignals, tampered);
  assert.equal(ok, false);
});

test("tampered public input fails verification", async () => {
  const { proof, publicSignals } = await proveOrFail(VALID_PATIENT);
  const tamperedSignals = [...publicSignals];
  tamperedSignals[1] = "99"; // corrupt minAge's public echo
  const ok = await snarkjs.groth16.verify(VKEY, tamperedSignals, proof);
  assert.equal(ok, false);
});
