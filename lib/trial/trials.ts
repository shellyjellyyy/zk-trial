// lib/trial/trials.ts
//
// Loads the structured, versionable trial configuration files under /trials.
// The frontend reads trial definitions from here rather than hardcoding them,
// so adding a new trial is a matter of adding a new JSON file.

export interface TrialCriteria {
  age: { min: number; max: number };
  biomarker: { min: number; max: number };
  medication_x: boolean;
  country: string;
  pregnant: boolean;
  condition_y: boolean;
}

export interface TrialConfig {
  trialId: string;
  title: string;
  description: string;
  sponsor: string;
  status: "active" | "closed" | "draft";
  criteria: TrialCriteria;
  inclusion: string[];
  exclusion: string[];
  circuitConfigHash: string;
  countryCode: number;
}

// Statically imported so the trial list is bundled and available client-side
// without an extra network round trip to a backend.
import trial001 from "../../trials/trial-001.json";

export const TRIALS: TrialConfig[] = [trial001 as TrialConfig];

export function getTrial(trialId: string): TrialConfig | undefined {
  return TRIALS.find((t) => t.trialId === trialId);
}

/**
 * Converts a trial's human-readable criteria into the exact public-signal
 * shape the eligibility.circom circuit expects. This is the single place
 * that maps "trial config" -> "circuit public inputs", so the circuit and
 * the UI never drift out of sync.
 */
export function trialToCircuitPublicSignals(trial: TrialConfig) {
  return {
    minAge: trial.criteria.age.min,
    maxAge: trial.criteria.age.max,
    minBiomarker: trial.criteria.biomarker.min,
    maxBiomarker: trial.criteria.biomarker.max,
    requiredMedicationX: trial.criteria.medication_x ? 1 : 0,
    requiredCountryCode: trial.countryCode,
    // criteria.pregnant / criteria.condition_y are always `false` in a valid
    // trial config, meaning "being pregnant" / "having condition Y" is
    // disqualifying. The circuit checks private_value !== forbiddenValue,
    // so the forbidden value is always the "true" (1) state.
    forbiddenPregnant: 1,
    forbiddenConditionY: 1,
    trialId: numericTrialId(trial.trialId),
  };
}

export function numericTrialId(trialId: string): number {
  // "TRIAL-001" -> 1. Deterministic, small, and easy for a college dev to audit.
  const match = trialId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}
