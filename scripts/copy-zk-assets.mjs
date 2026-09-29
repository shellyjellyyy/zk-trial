// Copies the compiled Compact ZK artifacts (managed/zk-trial) into public/zk
// so the browser can fetch them at /zk/keys/{circuit}.prover|.verifier and
// /zk/zkir/{circuit}.bzkir — exactly the layout FetchZkConfigProvider expects.
//
// The .prover files are large but public key material: they are needed by the
// in-browser/wallet prover and contain no secrets. The contract's verifier
// keys are also published so midnight-js can bind calls to the deployed
// contract.
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const src = resolve(projectRoot, "managed/zk-trial");
const dst = resolve(projectRoot, "public/zk");

if (!existsSync(src)) {
  console.error(
    `copy-zk-assets: ${src} does not exist. Run 'npm run compact:compile' first.`,
  );
  process.exit(1);
}

// Fresh copy each build so stale artifacts can never survive a recompile.
// Staging to a temp directory first keeps the public files continuously
// fetchable: the served tree is only swapped in one rename after the full
// copy succeeded, so a running dev/prod server never serves a half-copied
// (or missing) verifier key while a build is in progress.
const staging = `${dst}.staging`;
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(src, staging, { recursive: true });
rmSync(dst, { recursive: true, force: true });
renameSync(staging, dst);

console.log(`copy-zk-assets: ${src} -> ${dst}`);
