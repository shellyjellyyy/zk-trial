import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger, Witnesses } from "../managed/zk-trial/contract/index.js";

export const INDIA_COUNTRY_CODE = 356;

export type EligibilityInputs = {
  age: number;
  biomarker: number;
  medicationX: boolean;
  country: number;
  pregnant: boolean;
  conditionY: boolean;
};

export type ZkTrialPrivateState = EligibilityInputs & {
  seed: Uint8Array;
};

export function newSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed;
}

export function privateStateFrom(
  inputs: EligibilityInputs,
  seed: Uint8Array,
): ZkTrialPrivateState {
  return { ...inputs, seed };
}

export function seedToHex(seed: Uint8Array): string {
  return Array.from(seed)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function seedFromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error("Participant seed must be 32 bytes of hex (64 characters).");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const witnesses: Witnesses<ZkTrialPrivateState> = {
  eligibility: (context: WitnessContext<Ledger, ZkTrialPrivateState>) => {
    const ps = context.privateState;
    return [
      ps,
      [
        BigInt(ps.age),
        BigInt(ps.biomarker),
        ps.medicationX,
        BigInt(ps.country),
        ps.pregnant,
        ps.conditionY,
        ps.seed,
      ],
    ];
  },
};
