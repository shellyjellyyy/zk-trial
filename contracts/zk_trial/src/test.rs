#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Env};

fn setup() -> (Env, ZkTrialContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ZkTrialContract);
    let client = ZkTrialContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init_admin(&admin);
    (env, client, admin)
}

fn hash(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_initialize_trial_and_get_metadata() {
    let (env, client, admin) = setup();
    let trial_id = Symbol::new(&env, "TRIAL001");
    let config_hash = hash(&env, 1);

    client.initialize_trial(&admin, &trial_id, &config_hash);

    let meta = client.get_trial(&trial_id);
    assert_eq!(meta.trial_id, trial_id);
    assert_eq!(meta.config_hash, config_hash);
    assert_eq!(meta.enrollment_count, 0);
    assert!(meta.active);
}

#[test]
fn test_cannot_initialize_same_trial_twice() {
    let (env, client, admin) = setup();
    let trial_id = Symbol::new(&env, "TRIAL001");
    let config_hash = hash(&env, 1);
    client.initialize_trial(&admin, &trial_id, &config_hash);

    let result = client.try_initialize_trial(&admin, &trial_id, &config_hash);
    assert_eq!(result, Err(Ok(ContractError::TrialAlreadyExists)));
}

#[test]
fn test_record_enrollment_increments_count() {
    let (env, client, admin) = setup();
    let trial_id = Symbol::new(&env, "TRIAL001");
    client.initialize_trial(&admin, &trial_id, &hash(&env, 1));

    let n1 = hash(&env, 10);
    let n2 = hash(&env, 20);

    let idx1 = client.record_enrollment(&trial_id, &n1);
    assert_eq!(idx1, 1);

    let idx2 = client.record_enrollment(&trial_id, &n2);
    assert_eq!(idx2, 2);

    assert_eq!(client.get_enrollment_count(&trial_id), 2);
}

#[test]
fn test_duplicate_nullifier_rejected() {
    let (env, client, admin) = setup();
    let trial_id = Symbol::new(&env, "TRIAL001");
    client.initialize_trial(&admin, &trial_id, &hash(&env, 1));

    let nullifier = hash(&env, 42);
    client.record_enrollment(&trial_id, &nullifier);

    // Same nullifier again on the same trial must be rejected: this is the
    // anti-double-enrollment guarantee.
    let result = client.try_record_enrollment(&trial_id, &nullifier);
    assert_eq!(result, Err(Ok(ContractError::DuplicateNullifier)));
    assert_eq!(client.get_enrollment_count(&trial_id), 1);
}

#[test]
fn test_same_participant_different_trials_uses_different_nullifiers() {
    // Off-chain, nullifier = H(secret, trial_id), so the SAME secret produces
    // a DIFFERENT nullifier per trial. We simulate that here with two
    // distinct nullifier values (as the off-chain derivation would produce)
    // and confirm the contract does not conflate them.
    let (env, client, admin) = setup();
    let trial_a = Symbol::new(&env, "TRIAL001");
    let trial_b = Symbol::new(&env, "TRIAL002");
    client.initialize_trial(&admin, &trial_a, &hash(&env, 1));
    client.initialize_trial(&admin, &trial_b, &hash(&env, 2));

    let nullifier_for_trial_a = hash(&env, 111);
    let nullifier_for_trial_b = hash(&env, 222);

    client.record_enrollment(&trial_a, &nullifier_for_trial_a);
    client.record_enrollment(&trial_b, &nullifier_for_trial_b);

    assert_eq!(client.get_enrollment_count(&trial_a), 1);
    assert_eq!(client.get_enrollment_count(&trial_b), 1);
    assert!(client.has_enrolled(&trial_a, &nullifier_for_trial_a));
    assert!(!client.has_enrolled(&trial_a, &nullifier_for_trial_b));
}

#[test]
fn test_enrollment_on_unknown_trial_fails() {
    let (env, client, _admin) = setup();
    let trial_id = Symbol::new(&env, "GHOST");
    let nullifier = hash(&env, 5);
    let result = client.try_record_enrollment(&trial_id, &nullifier);
    assert_eq!(result, Err(Ok(ContractError::TrialNotFound)));
}

#[test]
fn test_double_admin_init_fails() {
    let (_env, client, admin) = setup();
    let result = client.try_init_admin(&admin);
    assert_eq!(result, Err(Ok(ContractError::AlreadyInitialized)));
}

#[test]
fn test_non_admin_cannot_initialize_trial() {
    let (env, client, _admin) = setup();
    let not_admin = Address::generate(&env);
    let trial_id = Symbol::new(&env, "TRIAL999");
    let result = client.try_initialize_trial(&not_admin, &trial_id, &hash(&env, 1));
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
}
