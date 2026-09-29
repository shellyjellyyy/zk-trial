"use client";

import {
  DEPLOYED_CONTRACT_ADDRESS,
  NETWORK,
  networkLabel,
} from "../midnight/config";
import {
  joinZkTrial,
  fetchEnrollmentCount,
  type ZkTrialFound,
} from "../midnight/contract-api";
import type { ZkTrialProviders } from "../midnight/providers";

/** localStorage key used by the browser-side deploy flow to remember the
 * contract address of THIS browser's deployment (before it is baked into
 * NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS for everyone). */
export const CONTRACT_ADDRESS_STORAGE_KEY = "zk-trial.contractAddress";

export function rememberContractAddress(address: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTRACT_ADDRESS_STORAGE_KEY, address);
}

/**
 * Resolve the zk-trial contract address for this deployment.
 *
 * Priority: NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS (baked at build time, e.g.
 * from the Vercel dashboard) > the address recorded in localStorage by a
 * browser-side deployment through 1AM Wallet > the value in
 * src/midnight/config.ts. Empty string means "not deployed yet" and the UI
 * must show that honestly.
 */
export function resolveContractAddress(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS?.trim() ?? "";
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const fromLocal =
      window.localStorage.getItem(CONTRACT_ADDRESS_STORAGE_KEY)?.trim() ?? "";
    if (fromLocal) return fromLocal;
  }
  return DEPLOYED_CONTRACT_ADDRESS.trim();
}

export function isContractDeployed(): boolean {
  return resolveContractAddress().length > 0;
}

export type JoinOutcome =
  | { ok: true; contract: ZkTrialFound }
  | { ok: false; error: string };

/**
 * Join the deployed zk-trial contract with the connected wallet's providers.
 * All errors are returned, never swallowed: the UI shows exactly what went
 * wrong (address typo, indexer unreachable, verifier-key mismatch, ...).
 */
export async function joinDeployedContract(
  providers: ZkTrialProviders,
): Promise<JoinOutcome> {
  const address = resolveContractAddress();
  if (!address) {
    return {
      ok: false,
      error:
        "No zk-trial contract address is configured for this build. Deploy the contract to Midnight Preprod first.",
    };
  }
  try {
    const contract = await joinZkTrial(providers, address);
    return { ok: true, contract };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export { fetchEnrollmentCount, networkLabel, NETWORK };
