//! zk-trial Soroban contract
//!
//! WHAT THIS CONTRACT STORES ON-CHAIN (and nothing else):
//!   - trial_id            (Symbol)             e.g. "TRIAL001"
//!   - trial_config_hash   (BytesN<32>)         hash of the off-chain trial JSON config
//!   - enrollment_count    (u32)                running total of verified enrollments
//!   - nullifiers          (Map<BytesN<32>, u64>)  anonymous per-trial commitments -> enrollment timestamp,
//!                                               used ONLY to reject duplicate enrollment
//!
//! WHAT THIS CONTRACT NEVER STORES:
//!   age, biomarker values, medication status, pregnancy/condition status,
//!   raw health JSON, or any value from which those could be derived. The ZK
//!   proof that establishes eligibility is generated and verified OFF-CHAIN,
//!   in the participant's browser and, redundantly, in the backend-free proof
//!   verification step before a transaction is ever built (see
//!   lib/zk/proof.ts and docs/ARCHITECTURE.md). This contract is the
//!   immutable public attestation/enrollment-counter layer described in the
//!   project's architecture: it does not itself run Groth16 verification.
//!
//! DEDUPLICATION MODEL:
//!   `record_enrollment` takes an anonymous, trial-scoped nullifier
//!   (see lib/privacy/nullifier.ts) instead of a wallet address or any
//!   patient identifier. The same nullifier can only be recorded once per
//!   trial. See SECURITY.md for the full threat model and its limitations.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Map, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct TrialMeta {
    pub trial_id: Symbol,
    pub config_hash: BytesN<32>,
    pub enrollment_count: u32,
    pub active: bool,
}

#[contracttype]
pub enum DataKey {
    Trial(Symbol),                 // trial_id -> TrialMeta
    Nullifiers(Symbol),            // trial_id -> Map<nullifier, timestamp>
    Admin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    TrialNotFound = 2,
    TrialAlreadyExists = 3,
    TrialInactive = 4,
    DuplicateNullifier = 5,
    NotAuthorized = 6,
}

#[contract]
pub struct ZkTrialContract;

#[contractimpl]
impl ZkTrialContract {
    /// One-time contract setup. `admin` is authorized to initialize new
    /// trials; it never gains access to any participant data because none
    /// is ever stored here.
    pub fn init_admin(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Registers a new trial. `config_hash` is a hash of the off-chain
    /// trial JSON (inclusion/exclusion criteria) so the frontend and any
    /// third party can verify which exact eligibility rules a given
    /// enrollment count corresponds to, without any criteria being stored
    /// on-chain in plaintext.
    pub fn initialize_trial(
        env: Env,
        admin: Address,
        trial_id: Symbol,
        config_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotAuthorized)?;
        if stored_admin != admin {
            return Err(ContractError::NotAuthorized);
        }
        admin.require_auth();

        let key = DataKey::Trial(trial_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(ContractError::TrialAlreadyExists);
        }

        let meta = TrialMeta {
            trial_id: trial_id.clone(),
            config_hash: config_hash.clone(),
            enrollment_count: 0,
            active: true,
        };
        env.storage().persistent().set(&key, &meta);
        env.storage()
            .persistent()
            .set(&DataKey::Nullifiers(trial_id.clone()), &Map::<BytesN<32>, u64>::new(&env));

        env.events().publish(
            (symbol_short!("trl_init"), trial_id),
            config_hash,
        );
        Ok(())
    }

    /// Records one verified, anonymous enrollment for a trial.
    ///
    /// `nullifier` must be a value derived off-chain from a participant
    /// secret scoped to this trial (see lib/privacy/nullifier.ts). This
    /// call performs NO cryptographic proof verification itself -- the
    /// caller (frontend) is expected to have already generated and verified
    /// the Groth16 eligibility proof off-chain before submitting this
    /// transaction. This is documented explicitly as an MVP boundary in
    /// README.md / docs/ARCHITECTURE.md: this contract is the public
    /// attestation/counter layer, not the ZK verifier.
    pub fn record_enrollment(
        env: Env,
        trial_id: Symbol,
        nullifier: BytesN<32>,
    ) -> Result<u32, ContractError> {
        let trial_key = DataKey::Trial(trial_id.clone());
        let mut meta: TrialMeta = env
            .storage()
            .persistent()
            .get(&trial_key)
            .ok_or(ContractError::TrialNotFound)?;

        if !meta.active {
            return Err(ContractError::TrialInactive);
        }

        let nullifiers_key = DataKey::Nullifiers(trial_id.clone());
        let mut nullifiers: Map<BytesN<32>, u64> = env
            .storage()
            .persistent()
            .get(&nullifiers_key)
            .unwrap_or_else(|| Map::new(&env));

        if nullifiers.contains_key(nullifier.clone()) {
            return Err(ContractError::DuplicateNullifier);
        }

        let timestamp = env.ledger().timestamp();
        nullifiers.set(nullifier, timestamp);
        env.storage().persistent().set(&nullifiers_key, &nullifiers);

        meta.enrollment_count += 1;
        env.storage().persistent().set(&trial_key, &meta);

        env.events().publish(
            (symbol_short!("enrolled"), trial_id),
            (meta.enrollment_count, timestamp),
        );

        Ok(meta.enrollment_count)
    }

    pub fn get_enrollment_count(env: Env, trial_id: Symbol) -> Result<u32, ContractError> {
        let meta: TrialMeta = env
            .storage()
            .persistent()
            .get(&DataKey::Trial(trial_id))
            .ok_or(ContractError::TrialNotFound)?;
        Ok(meta.enrollment_count)
    }

    pub fn get_trial(env: Env, trial_id: Symbol) -> Result<TrialMeta, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Trial(trial_id))
            .ok_or(ContractError::TrialNotFound)
    }

    pub fn has_enrolled(env: Env, trial_id: Symbol, nullifier: BytesN<32>) -> bool {
        let nullifiers: Map<BytesN<32>, u64> = env
            .storage()
            .persistent()
            .get(&DataKey::Nullifiers(trial_id))
            .unwrap_or_else(|| Map::new(&env));
        nullifiers.contains_key(nullifier)
    }
}

mod test;
