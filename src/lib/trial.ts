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
  countryCode: number;
}

import trial001Json from "../../trials/trial-001.json";

export const TRIALS: TrialConfig[] = [trial001Json as TrialConfig];

export function getTrial(trialId: string): TrialConfig | undefined {
  return TRIALS.find((t) => t.trialId === trialId);
}

export function trialIdBytes(trialId: string): Uint8Array {
  const out = new Uint8Array(32);
  new TextEncoder().encodeInto(trialId, out);
  return out;
}
