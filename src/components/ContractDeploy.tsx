"use client";

import { useState } from "react";
import { signingKeyFromBip340 } from "@midnight-ntwrk/compact-runtime";
import { TRIALS } from "@/lib/trial";
import { useMidnight } from "../hooks/useMidnight";
import { deployZkTrial } from "../midnight/contract-api";
import { networkLabel, zkAssetsBaseUrl } from "../midnight/config";
import { rememberContractAddress } from "../utils/contract";

type DeployStage = "idle" | "connecting" | "deploying" | "done" | "error";

/**
 * Sponsor-side deployment panel.
 *
 * Runs the REAL deployContract() pipeline against Midnight Preprod through
 * the connected 1AM Wallet: constructor proof (wallet prover), balancing
 * (wallet/ProofStation sponsors the dust), wallet-relayed submission, then
 * finalization confirmation via the indexer. On success it records the real
 * contract address for this browser and prints it for baking into
 * NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS.
 *
 * Nothing here is simulated: if any step fails the panel shows the actual
 * error and no address is recorded.
 */
export default function ContractDeploy({
  onDeployed,
}: {
  onDeployed?: () => void;
}) {
  const { status: walletStatus, error: walletError } = useMidnight();
  const [stage, setStage] = useState<DeployStage>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [deployTxId, setDeployTxId] = useState<string | null>(null);
  const [connectedOnce, setConnectedOnce] = useState(false);

  const trial = TRIALS[0];

  async function handleDeploy() {
    setErrorMessage(null);
    setDetail(null);

    // Build the connection/providers directly in this handler: the hook's
    // `providers` state updates on a later render, so reading it here would
    // race with connect().
    let activeProviders;
    setStage("connecting");
    setDetail("Connecting 1AM Wallet…");
    try {
      const { connect1AMWallet } = await import("../midnight/wallet");
      const { createProvidersFromWallet, makeFetchZkConfigProvider } =
        await import("../midnight/providers");
      const connection = await connect1AMWallet();
      activeProviders = await createProvidersFromWallet(
        connection,
        makeFetchZkConfigProvider(zkAssetsBaseUrl()),
      );
      setConnectedOnce(true);
    } catch (e) {
      console.error("[zk-trial] Deployment setup failed", e);
      setErrorMessage(formatErrorChain(e));
      setStage("error");
      return;
    }

    setStage("deploying");
    setDetail("Generating deployment proof (this can take a few seconds)…");
    try {
      const result = await deployZkTrial(activeProviders, {
        trialId: trial.trialId,
        sponsor: trial.sponsor,
        // Deterministic per-deployment maintenance key derived locally; the
        // contract maintenance authority only matters for circuit upgrades.
        signingKey: await demoMaintenanceSigningKey(trial.trialId),
      });

      setDeployedAddress(result.contractAddress);
      setDeployTxId(result.txId);
      rememberContractAddress(result.contractAddress);
      setStage("done");
      setDetail(
        `Confirmed in block ${result.blockHeight ?? "?"}. The address is now used by this browser; bake it into NEXT_PUBLIC_ZKTRIAL_CONTRACT_ADDRESS for all visitors.`,
      );
      onDeployed?.();
    } catch (e) {
      console.error("[zk-trial] Deployment failed", e);
      setErrorMessage(formatErrorChain(e));
      setStage("error");
      setDetail(null);
    }
  }

  if (stage === "done" && deployedAddress) {
    return (
      <div className="mt-6 glass-card p-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Contract deployed to {networkLabel()}
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Contract address
            </dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-slate-200">
              {deployedAddress}
            </dd>
          </div>
          {deployTxId && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Deployment transaction
              </dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-slate-200">
                {deployTxId}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-xs text-slate-500">{detail}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 glass-card p-6">
      <h2 className="text-sm font-medium text-slate-200">
        Deploy the zk-trial contract
      </h2>
      <p className="mt-2 text-xs text-slate-400">
        One-time sponsor action: deploys the Compact contract (constructor args:{" "}
        {trial.trialId} + sponsor name) to {networkLabel()} through your
        connected 1AM Wallet. 1AM&apos;s ProofStation sponsors the fees — no
        NIGHT or DUST required.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void handleDeploy()}
          disabled={stage === "connecting" || stage === "deploying"}
          className="btn-primary"
        >
          {stage === "connecting" && "Connecting 1AM Wallet…"}
          {stage === "deploying" && "Deploying…"}
          {(stage === "idle" || stage === "error") &&
            (connectedOnce || walletStatus === "connected"
              ? "Deploy to Midnight Preprod"
              : "Connect 1AM Wallet and deploy")}
        </button>
        {(connectedOnce || walletStatus === "connected") && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            1AM Wallet connected
          </span>
        )}
      </div>

      {stage === "connecting" && (
        <p className="mt-3 text-xs text-accent-glow">Connecting 1AM Wallet…</p>
      )}
      {stage === "deploying" && detail && (
        <p className="mt-3 text-xs text-accent-glow">{detail}</p>
      )}
      {(stage === "error" || walletError) && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <p className="font-medium">Deployment failed</p>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans">
            {errorMessage ?? walletError}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Deterministic contract-maintenance signing key derived from a local hash of
 * the trial id — a deploy-only convenience so re-runs are reproducible per
 * trial. It never leaves the browser and signs nothing on behalf of users.
 */
async function demoMaintenanceSigningKey(trialId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`zk-trial:maintenance:${trialId}`),
  );
  return signingKeyFromBip340(new Uint8Array(digest));
}

/** Preserve the SDK's nested Error.cause values instead of showing its wrapper only. */
function formatErrorChain(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = current as { name?: unknown; message?: unknown; cause?: unknown };
    const name = typeof value.name === "string" ? value.name : "Error";
    const message =
      typeof value.message === "string" ? value.message : String(current);
    messages.push(`${name}: ${message}`);
    current = value.cause;
  }

  if (messages.length > 0) return messages.join("\nCaused by: ");
  return String(error);
}
