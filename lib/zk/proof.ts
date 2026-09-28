// lib/zk/proof.ts
//
// Thin wrapper around snarkjs that runs entirely in the browser. Private
// health values are passed in-memory to `generateEligibilityProof` and are
// never sent anywhere by this module -- snarkjs computes the witness and
// the Groth16 proof locally using WebAssembly.
//
// IMPORTANT: this module must never call fetch()/XHR with the `privateInput`
// values it receives. Only the wasm/zkey circuit artifacts (which contain no
// participant data) are fetched, from same-origin /circuits/eligibility/.

// snarkjs ships as CommonJS with browser-friendly bundles; loaded dynamically
// so this module tree-shakes cleanly for both Node (tests) and browser (app).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs = require("snarkjs");

export interface PrivateHealthInputs {
  age: number;
  biomarker: number;
  medicationX: boolean;
  countryCode: number;
  pregnant: boolean;
  conditionY: boolean;
  /** Random per-participant secret, used only for nullifier derivation (see lib/privacy). Never a real identity value. */
  salt: number;
}

export interface TrialPublicSignals {
  minAge: number;
  maxAge: number;
  minBiomarker: number;
  maxBiomarker: number;
  requiredMedicationX: number;
  requiredCountryCode: number;
  forbiddenPregnant: number;
  forbiddenConditionY: number;
  trialId: number;
}

export interface EligibilityProofResult {
  proof: unknown;
  publicSignals: string[];
}

const WASM_PATH = "/circuits/eligibility/eligibility.wasm";
const ZKEY_PATH = "/circuits/eligibility/eligibility.zkey";
const VKEY_PATH = "/circuits/eligibility/verification_key.json";

/**
 * Generates a Groth16 proof that the given private health inputs satisfy the
 * given trial's public eligibility parameters. Runs entirely client-side.
 *
 * Throws if the participant does NOT satisfy every predicate -- there is no
 * "eligible: false" proof. Witness generation for an ineligible profile is
 * unsatisfiable by construction (see circuits/eligibility/eligibility.circom).
 */
export async function generateEligibilityProof(
  privateInputs: PrivateHealthInputs,
  publicSignals: TrialPublicSignals
): Promise<EligibilityProofResult> {
  const circuitInputs = {
    age: privateInputs.age,
    biomarker: privateInputs.biomarker,
    medicationX: privateInputs.medicationX ? 1 : 0,
    countryCode: privateInputs.countryCode,
    pregnant: privateInputs.pregnant ? 1 : 0,
    conditionY: privateInputs.conditionY ? 1 : 0,
    salt: privateInputs.salt,
    minAge: publicSignals.minAge,
    maxAge: publicSignals.maxAge,
    minBiomarker: publicSignals.minBiomarker,
    maxBiomarker: publicSignals.maxBiomarker,
    requiredMedicationX: publicSignals.requiredMedicationX,
    requiredCountryCode: publicSignals.requiredCountryCode,
    forbiddenPregnant: publicSignals.forbiddenPregnant,
    forbiddenConditionY: publicSignals.forbiddenConditionY,
    trialId: publicSignals.trialId,
  };

  try {
    const { proof, publicSignals: outSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      WASM_PATH,
      ZKEY_PATH
    );
    return { proof, publicSignals: outSignals };
  } catch (err) {
    // A thrown assertion here means the private profile did not satisfy the
    // circuit's combined predicate -- this IS the eligibility check.
    throw new EligibilityNotSatisfiedError(
      "Private health profile does not satisfy this trial's eligibility circuit."
    );
  }
}

export class EligibilityNotSatisfiedError extends Error {}

/**
 * Verifies a Groth16 proof against the local verification key. This can run
 * client-side (immediate UX feedback) and is independently re-checked by the
 * enrollment flow before a transaction is ever built.
 */
export async function verifyEligibilityProof(
  proof: unknown,
  publicSignals: string[]
): Promise<boolean> {
  const vkeyResponse = await fetch(VKEY_PATH);
  const vkey = await vkeyResponse.json();
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}
