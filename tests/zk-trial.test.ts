import { beforeEach, describe, expect, it } from "vitest";
import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../managed/zk-trial/contract/index.js";
import {
  witnesses,
  privateStateFrom,
  seedFromHex,
  type EligibilityInputs,
  type ZkTrialPrivateState,
} from "../src/witnesses.js";
import { trialIdBytes } from "../src/lib/trial.js";

const COIN_PUBLIC_KEY = { bytes: new Uint8Array(32).fill(2) };
const TRIAL_001 = trialIdBytes("TRIAL-001");
const TRIAL_002 = trialIdBytes("TRIAL-002");
const SPONSOR = "Demo Biosciences";

const PARTICIPANT_A = seedFromHex("aa".repeat(32));
const PARTICIPANT_B = seedFromHex("bb".repeat(32));

const ELIGIBLE: EligibilityInputs = {
  age: 34,
  biomarker: 61,
  medicationX: true,
  country: 356,
  pregnant: false,
  conditionY: false,
};

type AnyContext = CircuitContext<ZkTrialPrivateState>;

function deploy(
  inputs: Partial<EligibilityInputs> = {},
  seed: Uint8Array = PARTICIPANT_A,
  trialId: Uint8Array = TRIAL_001,
) {
  const contract = new Contract(witnesses);
  const privateState: ZkTrialPrivateState = privateStateFrom({ ...ELIGIBLE, ...inputs }, seed);
  const init = contract.initialState(
    createConstructorContext(privateState, COIN_PUBLIC_KEY),
    trialId,
    SPONSOR,
  );
  const context = createCircuitContext(
    dummyContractAddress(),
    init.currentZswapLocalState.coinPublicKey,
    init.currentContractState,
    init.currentPrivateState,
  );
  return { contract, context };
}

function publicState(context: AnyContext) {
  return ledger(context.currentQueryContext.state);
}

function enroll(deployed: { contract: Contract; context: AnyContext }) {
  return deployed.contract.impureCircuits.enroll(deployed.context);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function asParticipant(
  context: AnyContext,
  seed: Uint8Array,
  inputs: Partial<EligibilityInputs> = {},
): AnyContext {
  return createCircuitContext(
    dummyContractAddress(),
    context.currentZswapLocalState.coinPublicKey,
    context.currentQueryContext.state,
    privateStateFrom({ ...ELIGIBLE, ...inputs }, seed),
  );
}

describe("zk-trial Compact contract: deployment", () => {
  it("initialises an empty trial with no enrollments", () => {
    const { context } = deploy();
    const state = publicState(context);
    expect(state.enrollments).toBe(0n);
    expect(state.usedNullifiers.isEmpty()).toBe(true);
    expect(state.sponsor).toBe(SPONSOR);
    expect(toHex(state.trialId)).toBe(toHex(TRIAL_001));
  });

  it("exposes the enrollment count through the read circuit", () => {
    const deployed = deploy();
    const result = deployed.contract.impureCircuits.getEnrollmentCount(deployed.context);
    expect(result.result).toBe(0n);
  });
});

describe("zk-trial Compact contract: eligible enrollment", () => {
  let deployed: ReturnType<typeof deploy>;

  beforeEach(() => {
    deployed = deploy();
  });

  it("accepts a participant meeting every criterion", () => {
    const result = enroll(deployed);
    expect(result.result).toBeInstanceOf(Uint8Array);
    expect(result.result.length).toBe(32);
  });

  it("increments the public enrollment counter", () => {
    const result = enroll(deployed);
    expect(publicState(result.context).enrollments).toBe(1n);
  });

  it("records exactly one nullifier", () => {
    const result = enroll(deployed);
    const state = publicState(result.context);
    expect(state.usedNullifiers.size()).toBe(1n);
    expect(state.usedNullifiers.member(result.result)).toBe(true);
  });

  it("agrees between the counter circuit and the ledger counter", () => {
    const result = enroll(deployed);
    const count = deployed.contract.impureCircuits.getEnrollmentCount(result.context);
    expect(count.result).toBe(1n);
    expect(publicState(result.context).enrollments).toBe(count.result);
  });

  it("produces proof data for the enrollment circuit", () => {
    const result = enroll(deployed);
    expect(result.proofData).toBeDefined();
    expect(result.proofData.publicTranscript.length).toBeGreaterThan(0);
  });
});

describe("zk-trial Compact contract: privacy", () => {
  it("never publishes the participant seed", () => {
    const deployed = deploy({}, PARTICIPANT_A);
    const result = enroll(deployed);
    const state = publicState(result.context);
    expect(toHex(result.result)).not.toBe(toHex(PARTICIPANT_A));
    for (const nullifier of state.usedNullifiers) {
      expect(toHex(nullifier)).not.toBe(toHex(PARTICIPANT_A));
    }
  });

  it("keeps the medical inputs in private state, not in the ledger", () => {
    const deployed = deploy();
    const result = enroll(deployed);
    const state = publicState(result.context) as unknown as Record<string, unknown>;
    const privateState = result.context.currentPrivateState;
    expect(privateState.age).toBe(ELIGIBLE.age);
    expect(privateState.biomarker).toBe(ELIGIBLE.biomarker);
    expect(state.age).toBeUndefined();
    expect(state.biomarker).toBeUndefined();
    expect(state.medicationX).toBeUndefined();
    expect(state.pregnant).toBeUndefined();
    expect(state.conditionY).toBeUndefined();
  });

  it("publishes only the trial id, sponsor, count and nullifier set", () => {
    const deployed = deploy();
    const result = enroll(deployed);
    const state = publicState(result.context);
    expect(Object.keys(state).sort()).toEqual([
      "enrollments",
      "sponsor",
      "trialId",
      "usedNullifiers",
    ]);
  });

  it("derives different nullifiers for the same participant in different trials", () => {
    const first = enroll(deploy({}, PARTICIPANT_A, TRIAL_001));
    const second = enroll(deploy({}, PARTICIPANT_A, TRIAL_002));
    expect(toHex(first.result)).not.toBe(toHex(second.result));
  });
});

describe("zk-trial Compact contract: criteria are enforced", () => {
  const cases: Array<[string, Partial<EligibilityInputs>, string]> = [
    ["age below the minimum", { age: 17 }, "Age below the minimum of 18"],
    ["age above the maximum", { age: 66 }, "Age above the maximum of 65"],
    ["biomarker below the minimum", { biomarker: 39 }, "Biomarker below the minimum of 40"],
    ["biomarker above the maximum", { biomarker: 81 }, "Biomarker above the maximum of 80"],
    ["medication X not taken", { medicationX: false }, "Medication X is not being taken"],
    ["resident outside India", { country: 840 }, "Resident country is not India"],
    ["currently pregnant", { pregnant: true }, "Pregnant participants are excluded"],
    ["excluded condition present", { conditionY: true }, "Excluded condition is present"],
  ];

  for (const [name, inputs, message] of cases) {
    it(`rejects a participant with ${name}`, () => {
      const deployed = deploy(inputs);
      expect(() => enroll(deployed)).toThrow(message);
    });

    it(`leaves the trial unchanged after rejecting ${name}`, () => {
      const deployed = deploy(inputs);
      expect(() => enroll(deployed)).toThrow();
      const state = publicState(deployed.context);
      expect(state.enrollments).toBe(0n);
      expect(state.usedNullifiers.isEmpty()).toBe(true);
    });
  }
});

describe("zk-trial Compact contract: boundary values are inclusive", () => {
  const accepted: Array<[string, Partial<EligibilityInputs>]> = [
    ["the minimum age", { age: 18 }],
    ["the maximum age", { age: 65 }],
    ["the minimum biomarker", { biomarker: 40 }],
    ["the maximum biomarker", { biomarker: 80 }],
  ];

  for (const [name, inputs] of accepted) {
    it(`accepts ${name}`, () => {
      const deployed = deploy(inputs);
      expect(enroll(deployed).result.length).toBe(32);
    });
  }
});

describe("zk-trial Compact contract: duplicate prevention", () => {
  it("rejects a second enrollment by the same participant in the same trial", () => {
    const first = enroll(deploy());
    const second = deploy();
    const chained = { contract: second.contract, context: first.context as AnyContext };
    expect(() => enroll(chained)).toThrow("Already enrolled in this trial");
  });

  it("keeps the counter at one after a rejected duplicate", () => {
    const first = enroll(deploy());
    const second = deploy();
    const chained = { contract: second.contract, context: first.context as AnyContext };
    expect(() => enroll(chained)).toThrow();
    expect(publicState(first.context).enrollments).toBe(1n);
    expect(publicState(first.context).usedNullifiers.size()).toBe(1n);
  });

  it("allows distinct participants to enroll", () => {
    const first = enroll(deploy({}, PARTICIPANT_A));
    const second = deploy({}, PARTICIPANT_B);
    const asB = asParticipant(first.context, PARTICIPANT_B);
    const result = enroll({ contract: second.contract, context: asB });
    const state = publicState(result.context);
    expect(state.enrollments).toBe(2n);
    expect(state.usedNullifiers.size()).toBe(2n);
  });

  it("produces a stable nullifier for the same participant and trial", () => {
    const first = enroll(deploy({}, PARTICIPANT_A));
    const second = enroll(deploy({}, PARTICIPANT_A));
    expect(toHex(first.result)).toBe(toHex(second.result));
  });
});
