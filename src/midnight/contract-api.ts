import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  deployContract,
  findDeployedContract,
  type FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import type { FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";
import { privateStateFrom, type EligibilityInputs } from "../witnesses";
import { trialIdBytes } from "../lib/trial";
import {
  ZkTrialCompiledContract,
  zkTrialLedger,
  type ZkTrialLedger,
} from "./contract";
import { onTransactionStage } from "./providers";
import type { ZkTrialProviders } from "./providers";

export const ZK_TRIAL_PRIVATE_STATE_ID = "zk-trial-private-state";

type ManagedContract = import("../../managed/zk-trial/contract/index.js").Contract<ZkTrialPS>;
type ZkTrialPS = import("../witnesses").ZkTrialPrivateState;

/** The joined/deployed zk-trial contract instance from midnight-js. */
export type ZkTrialFound = FoundContract<ManagedContract>;

export type DeployResult = {
  contractAddress: string;
  txId: string | null;
  blockHeight: number | null;
  blockTimestamp: number | null;
};

export type EnrollResult = {
  /** Anonymous, trial-scoped nullifier returned by the enroll circuit. */
  nullifierHex: string;
  /** Transaction identifier of the finalized enrollment call. */
  txId: string;
  txHash: string | null;
  blockHeight: number | null;
};

export type EnrollStages = {
  /** Witness + ZK proof generation started. */
  onProving?: () => void;
  /** The wallet is balancing/approving the transaction. */
  onBalancing?: () => void;
  /** The sealed transaction is being submitted to Midnight Preprod. */
  onSubmitting?: () => void;
};

/**
 * Deploy a fresh zk-trial contract to the connected Midnight network through
 * the connected 1AM Wallet. The constructor publishes only the trial id and
 * the sponsor name; the deployment transaction is proved via the providers'
 * proofProvider, balanced by the wallet, and relayed to the network.
 */
export async function deployZkTrial(
  providers: ZkTrialProviders,
  options: { trialId: string; sponsor: string; signingKey: string },
): Promise<DeployResult> {
  const deployed = await deployContract(providers, {
    compiledContract: ZkTrialCompiledContract,
    signingKey: options.signingKey as never,
    args: [trialIdBytes(options.trialId), options.sponsor],
    // This contract has witnesses, so deploy requires a private state slot.
    // The deployer never enrolls; a neutral state satisfies the constructor.
    privateStateId: ZK_TRIAL_PRIVATE_STATE_ID,
    initialPrivateState: neutralPrivateState(),
  } as unknown as Parameters<typeof deployContract>[1]);

  const pub = deployed.deployTxData.public;
  return {
    contractAddress: deployed.deployTxData.public.contractAddress,
    txId: pub.txId ?? null,
    blockHeight: pub.blockHeight ?? null,
    blockTimestamp: pub.blockTimestamp ?? null,
  };
}

/**
 * Join an already-deployed zk-trial contract by its on-chain address.
 * midnight-js verifies that our locally compiled verifier keys match the
 * deployed contract, then hydrates the in-memory private state.
 */
export async function joinZkTrial(
  providers: ZkTrialProviders,
  contractAddress: ContractAddress | string,
): Promise<ZkTrialFound> {
  return findDeployedContract(providers, {
    compiledContract: ZkTrialCompiledContract,
    contractAddress: contractAddress as ContractAddress,
    privateStateId: ZK_TRIAL_PRIVATE_STATE_ID,
    initialPrivateState: neutralPrivateState(),
  } as unknown as Parameters<typeof findDeployedContract>[1]) as unknown as Promise<ZkTrialFound>;
}

/**
 * Run the private eligibility proof and submit the anonymous enrollment.
 *
 * This drives the full midnight-js pipeline for the `enroll` circuit:
 * witness execution (health data stays in the browser) -> ZK proof generation
 * (wallet prover, or the Preprod proof server) -> balancing by 1AM Wallet ->
 * wallet-relayed submission to Midnight Preprod -> finalization confirmed
 * through the Preprod indexer. The returned promise resolves only after the
 * transaction is finalized AND its guaranteed segment reports success.
 */
export async function enrollZkTrial(
  providers: ZkTrialProviders,
  contract: ZkTrialFound,
  inputs: EligibilityInputs,
  seed: Uint8Array,
  stages: EnrollStages = {},
): Promise<EnrollResult> {
  stages.onProving?.();

  // Forward provider-layer pipeline events (balancing via the wallet,
  // submission via the wallet relay) to the caller's stage callbacks.
  const offStage = onTransactionStage((stage) => {
    if (stage === "balancing") stages.onBalancing?.();
    if (stage === "submitting") stages.onSubmitting?.();
  });

  try {
    return await runEnrollCall(contract, inputs, seed, providers);
  } finally {
    offStage();
  }
}

async function runEnrollCall(
  contract: ZkTrialFound,
  inputs: EligibilityInputs,
  seed: Uint8Array,
  providers: ZkTrialProviders,
): Promise<EnrollResult> {
  const contractAddress = contract.deployTxData.public.contractAddress;

  // The generated callTx proxy binds the privateStateId at join/deploy time
  // and takes no circuit arguments for `enroll`. The private state holding
  // this participant's health inputs must be stored at that id right before
  // the call; witnesses read it from the provider at proving time.
  providers.privateStateProvider.setContractAddress(contractAddress);
  await providers.privateStateProvider.set(
    ZK_TRIAL_PRIVATE_STATE_ID,
    privateStateFrom(inputs, seed),
  );

  const callTx = contract.callTx as unknown as {
    enroll: () => Promise<TxDataLike>;
  };

  const txData = await callTx.enroll();

  const pub = txData.public;
  // Honest success check: midnight-js marks non-success statuses on the
  // finalized tx data. A "FailEntirely" transaction must never be reported
  // as an enrollment.
  if (pub.status && pub.status !== "SucceedEntirely") {
    throw new Error(
      `Enrollment transaction was finalized with status ${pub.status}. ` +
        `No enrollment was recorded on-chain.`,
    );
  }

  const result = (txData as { private?: { result?: unknown } }).private
    ?.result as Uint8Array | undefined;
  if (!result) {
    throw new Error(
      "Enrollment call finalized without returning a nullifier result.",
    );
  }

  return {
    nullifierHex: toHex(result),
    txId: pub.txId,
    txHash: pub.txHash ?? null,
    blockHeight: pub.blockHeight ?? null,
  };
}

/** Minimal structural view of FinalizedCallTxData we rely on. */
type TxDataLike = {
  public: FinalizedTxData;
  private?: { result?: unknown };
};

/**
 * Read the public enrollment counter straight from chain state via the
 * Preprod indexer. Returns null when no state is visible yet.
 */
export async function fetchEnrollmentCount(
  providers: ZkTrialProviders,
  contractAddress: ContractAddress | string,
): Promise<bigint | null> {
  const state = await providers.publicDataProvider.queryContractState(
    contractAddress as ContractAddress,
  );
  if (!state) return null;
  const ledger = zkTrialLedger(state.data) as ZkTrialLedger;
  return ledger.enrollments;
}

/** A neutral private state used only to satisfy join-time hydration. */
function neutralPrivateState(): ZkTrialPS {
  return privateStateFrom(
    {
      age: 0,
      biomarker: 0,
      medicationX: false,
      country: 0,
      pregnant: false,
      conditionY: false,
    },
    new Uint8Array(32),
  );
}
