# Architecture

## Data flow

```
 browser (participant)
 ┌──────────────────────────────────────────────────────────────────┐
 │  private health values (age, biomarker, medication, ...)          │
 │            │                                                      │
 │            ▼                                                      │
 │  ZK proof generation (snarkjs + compiled Circom circuit, WASM)    │
 │            │                                                      │
 │            ▼                                                      │
 │  local proof verification (snarkjs, against verification_key.json)│
 │            │                                                      │
 │            ▼                                                      │
 │  anonymous nullifier = SHA256(local secret, trial_id)             │
 └────────────┼─────────────────────────────────────────────────────┘
              │  ONLY {trial_id, nullifier, timestamp} crosses this line
              ▼
      Soroban transaction: record_enrollment(trial_id, nullifier)
              │
              ▼
      Stellar/Soroban smart contract (contracts/zk_trial)
        - rejects duplicate nullifier for the same trial
        - increments public enrollment_count
        - emits an event
              │
              ▼
      Sponsor dashboard reads enrollment_count via Soroban RPC
```

## Why the ZK proof is verified off-chain, not on-chain

Groth16/Circom-based proof verification requires BN254 pairing operations.
Implementing a genuine pairing-based Groth16 verifier as a Soroban contract
is a substantial undertaking on its own (Soroban's host environment does not
currently ship a ready-made BN254 pairing precompile the way some EVM chains
do), and doing it convincingly within an MVP's time budget risked exactly
the kind of "fake on-chain verification" this project explicitly avoids (see
`README.md` → "No fake features").

So this MVP makes a **deliberate, documented architecture choice**: the
cryptographic eligibility check happens off-chain, in the browser, using a
real Groth16 proof that is really generated and really verified with
snarkjs. The blockchain's job here is narrower and honestly described: it is
the **immutable public enrollment/attestation layer** — a tamper-evident,
publicly auditable counter and anti-duplicate-enrollment mechanism, not the
verifier of the cryptographic claim itself.

If you extend this project, the natural next step is an on-chain Groth16
verifier (e.g. compiling a pairing-check contract, or using a proof system
with lighter on-chain verification), which would let `record_enrollment`
take the proof itself and verify it on-chain before incrementing the
counter. This is called out as a roadmap item in `README.md`.

## Why Circom + snarkjs

Circom 2 is a mature, actively maintained circuit DSL with first-class
browser support via snarkjs (WASM witness generation + Groth16 proving
entirely client-side, no server round trip for the private inputs). This
lets "private inputs never leave the browser" be a real, checkable property
of the shipped code rather than a claim about a design that was never built.

## Why Stellar/Soroban

Soroban contracts are written in Rust, compiled to WASM, and have
first-class primitives (`Map`, `BytesN`, `Address`, ledger timestamps,
events) that map cleanly onto "anonymous enrollment counter with duplicate
protection" without needing a custom token or unusual account model. The
Stellar Testnet is the current public, freely-fundable (via Friendbot)
network used here as the required Level 4 "Preprod" target.

## Why local, deterministic AI-assisted matching

The spec requires the app to work without any paid API key. A hosted LLM
integration would make the whole project depend on a key nobody reviewing
the submission necessarily has. `lib/trial/matching.ts` instead scores
trials against a profile using simple, fully transparent weighted feature
matching — deterministic, inspectable, and correctly described as "automated
candidate ranking" rather than "the AI decided you're eligible." The
eligibility decision itself is always made by the ZK circuit, never by this
module.
