import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  eligibility(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, [bigint,
                                                                           bigint,
                                                                           boolean,
                                                                           bigint,
                                                                           boolean,
                                                                           boolean,
                                                                           Uint8Array]];
}

export type ImpureCircuits<PS> = {
  enroll(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getEnrollmentCount(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type ProvableCircuits<PS> = {
  enroll(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getEnrollmentCount(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  enroll(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getEnrollmentCount(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type Ledger = {
  readonly trialId: Uint8Array;
  readonly sponsor: string;
  readonly enrollments: bigint;
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               id_0: Uint8Array,
               name_0: string): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
