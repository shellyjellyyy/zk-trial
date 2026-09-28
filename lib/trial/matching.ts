// lib/trial/matching.ts
//
// "AI-assisted trial discovery"
//
// IMPORTANT SEPARATION OF CONCERNS:
//   - This module only SUGGESTS trials that might be worth checking. It does
//     NOT decide eligibility and its output is never sent anywhere or used
//     to authorize enrollment.
//   - The actual eligibility decision is made exclusively by the ZK circuit
//     in lib/zk/proof.ts. A trial suggested here can still be proven
//     ineligible, and a trial NOT suggested here could still be provably
//     eligible if the participant checks it directly.
//
// Implementation: this MVP uses deterministic weighted feature matching
// (a normalized distance/overlap score against each trial's public criteria
// envelope) rather than a hosted LLM, so the app has zero dependency on paid
// API keys and works fully offline. This is intentionally simple and is
// labeled "AI-assisted" in the sense of "automated candidate ranking," not
// "large language model reasoning" -- the README and UI are explicit about
// this so the matching step is never confused with real inference.

import { TrialConfig } from "./trials";

export interface DiscoveryProfile {
  age: number;
  biomarker: number;
  medicationX: boolean;
  countryCode: number;
  pregnant: boolean;
  conditionY: boolean;
}

export interface TrialMatch {
  trial: TrialConfig;
  score: number; // 0..1, higher = more likely a good candidate for on-the-spot proof check
  reasons: string[];
}

function withinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Deterministic local matching -- no network calls, no external model.
 * Produces a 0..1 relevance score per trial purely from public trial
 * criteria compared against the profile the participant is willing to
 * consider locally (this function runs client-side; the profile never
 * needs to leave the browser to compute suggestions).
 */
export function suggestTrials(profile: DiscoveryProfile, trials: TrialConfig[]): TrialMatch[] {
  return trials
    .map((trial) => {
      const c = trial.criteria;
      let score = 0;
      let checks = 0;
      const reasons: string[] = [];

      checks += 1;
      if (withinRange(profile.age, c.age.min, c.age.max)) {
        score += 1;
        reasons.push(`Age ${profile.age} is within the trial's ${c.age.min}-${c.age.max} range`);
      }

      checks += 1;
      if (withinRange(profile.biomarker, c.biomarker.min, c.biomarker.max)) {
        score += 1;
        reasons.push(
          `Biomarker level ${profile.biomarker} is within the trial's ${c.biomarker.min}-${c.biomarker.max} range`
        );
      }

      checks += 1;
      if (profile.medicationX === c.medication_x) {
        score += 1;
        reasons.push("Medication X status matches trial requirement");
      }

      checks += 1;
      // trial.countryCode is compared against a coarse ISO check performed
      // by the caller before this module runs; here we just compare the
      // boolean flags for pregnancy/condition exclusions.
      if (profile.pregnant === c.pregnant) {
        score += 1;
        reasons.push("Pregnancy status does not conflict with trial exclusions");
      }

      checks += 1;
      if (profile.conditionY === c.condition_y) {
        score += 1;
        reasons.push("Condition Y status does not conflict with trial exclusions");
      }

      return {
        trial,
        score: checks === 0 ? 0 : score / checks,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}
