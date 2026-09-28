// lib/privacy/nullifier.ts
//
// Anonymous enrollment nullifier.
//
// Goal: let the smart contract reject a second enrollment from the same
// participant in the same trial, WITHOUT the sponsor or the chain ever
// learning who the participant is or seeing their medical data.
//
// Construction (demo-grade, documented honestly in SECURITY.md):
//
//   nullifier = SHA256(secret || trialId)
//
// where `secret` is a random value generated and stored ONLY in the
// participant's browser (localStorage), never transmitted anywhere except
// as the final SHA-256 digest below.
//
// Properties this gives us:
//   - Same participant + same trial -> same nullifier -> contract can
//     detect and reject a duplicate enrollment.
//   - Same participant + different trial -> different nullifier (trial-scoped),
//     because trialId is mixed into the hash. Nullifiers cannot be linked
//     across trials.
//   - The nullifier reveals nothing about age/biomarker/medication/etc.,
//     because `secret` is independent of all medical fields.
//
// Explicit LIMITATIONS (see SECURITY.md for the full threat model):
//   - This is a simple hash commitment, not a cryptographic nullifier scheme
//     bound to the ZK circuit itself (e.g. via a Merkle-tree membership +
//     nullifier circuit like Semaphore/Tornado-style designs). A more rigorous
//     version would constrain the nullifier's derivation INSIDE the circuit
//     so a prover cannot submit an arbitrary nullifier unrelated to their
//     proof. That hardening is out of scope for this MVP and is called out
//     as a roadmap item.
//   - If a participant clears browser storage, they lose their `secret` and
//     could enroll again with a fresh one. Acceptable for a demo; not
//     acceptable for a production deduplication guarantee.

const SECRET_STORAGE_KEY = "zk-trial:participant-secret";

/** Returns the participant's persistent per-browser secret, creating one if absent. */
export function getOrCreateParticipantSecret(): string {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateParticipantSecret must run in the browser.");
  }
  let secret = window.localStorage.getItem(SECRET_STORAGE_KEY);
  if (!secret) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    secret = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    window.localStorage.setItem(SECRET_STORAGE_KEY, secret);
  }
  return secret;
}

/** Derives a trial-scoped anonymous nullifier from the participant secret. Browser only (uses Web Crypto). */
export async function deriveNullifier(secretHex: string, trialId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${secretHex}:${trialId}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Node-compatible variant used by tests and any server-side utility scripts. */
export function deriveNullifierNode(secretHex: string, trialId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require("crypto");
  return createHash("sha256").update(`${secretHex}:${trialId}`).digest("hex");
}
