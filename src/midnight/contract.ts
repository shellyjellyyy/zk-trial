import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as ManagedZkTrial from "../../managed/zk-trial/contract/index.js";
import {
  witnesses,
  type ZkTrialPrivateState,
} from "../witnesses";

export {
  Contract as ZkTrialContract,
  ledger as zkTrialLedger,
} from "../../managed/zk-trial/contract/index.js";
export type {
  Ledger as ZkTrialLedger,
  Witnesses as ZkTrialWitnesses,
} from "../../managed/zk-trial/contract/index.js";

/**
 * CompiledContract binding consumed by midnight-js 4.x deployContract /
 * findDeployedContract.
 *
 * - `make` registers the generated Contract class under the "zk-trial" tag.
 * - `withWitnesses` attaches the TypeScript witness implementations that feed
 *   private eligibility data into the circuits at proving time.
 * - `withCompiledFileAssets` points at the directory layout the compiled
 *   artifacts use (keys/{circuit}.prover|.verifier, zkir/{circuit}.bzkir). In
 *   the browser these resolve against public/zk/ served by the app; the
 *   FetchZkConfigProvider fetches exactly that layout.
 */
export const ZkTrialCompiledContract = CompiledContract.make(
  "zk-trial",
  ManagedZkTrial.Contract<ZkTrialPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("zk"),
);
