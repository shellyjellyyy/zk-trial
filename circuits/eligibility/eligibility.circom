pragma circom 2.1.9;

include "comparators.circom";

// zk-trial: eligibility circuit
//
// Proves, without revealing any private health value, that a participant's
// private profile satisfies ALL inclusion criteria and NONE of the
// exclusion criteria for a given clinical trial, in a single combined proof.
//
// PRIVATE INPUTS (never leave the participant's browser):
//   age              - participant age in years
//   biomarker        - participant biomarker A level
//   medicationX      - 1 if currently taking Medication X, else 0
//   countryCode      - ISO-3166-1 numeric country code
//   pregnant         - 1 if pregnant, else 0
//   conditionY       - 1 if diagnosed with Condition Y, else 0
//   salt             - random participant secret, used only to build the
//                      nullifier outside this circuit's public output
//
// PUBLIC INPUTS (safe to reveal to the sponsor / chain):
//   minAge, maxAge               - inclusion range bounds for age
//   minBiomarker, maxBiomarker   - inclusion range bounds for biomarker
//   requiredMedicationX          - required value of medicationX (0 or 1)
//   requiredCountryCode          - required country code
//   forbiddenPregnant            - disqualifying value of pregnant (1)
//   forbiddenConditionY          - disqualifying value of conditionY (1)
//   trialId                      - numeric identifier scoping this proof
//                                  to a specific trial configuration
//
// OUTPUT:
//   eligible - constrained to equal 1. If any predicate fails, no valid
//   witness exists and proof generation itself fails (see NoFakeEligible
//   assertion below) -- there is no path to a "false but accepted" proof.

template Eligibility(nBits) {
    // --- private inputs -----------------------------------------------
    signal input age;
    signal input biomarker;
    signal input medicationX;
    signal input countryCode;
    signal input pregnant;
    signal input conditionY;
    signal input salt; // unused inside constraints; reserved for nullifier derivation off-circuit

    // --- public inputs ---------------------------------------------------
    signal input minAge;
    signal input maxAge;
    signal input minBiomarker;
    signal input maxBiomarker;
    signal input requiredMedicationX;
    signal input requiredCountryCode;
    signal input forbiddenPregnant;
    signal input forbiddenConditionY;
    signal input trialId;

    // --- output ------------------------------------------------------
    signal output eligible;

    // age >= minAge
    component ageGteMin = GreaterEqThan(nBits);
    ageGteMin.in[0] <== age;
    ageGteMin.in[1] <== minAge;

    // age <= maxAge
    component ageLteMax = LessEqThan(nBits);
    ageLteMax.in[0] <== age;
    ageLteMax.in[1] <== maxAge;

    // biomarker >= minBiomarker
    component bioGteMin = GreaterEqThan(nBits);
    bioGteMin.in[0] <== biomarker;
    bioGteMin.in[1] <== minBiomarker;

    // biomarker <= maxBiomarker
    component bioLteMax = LessEqThan(nBits);
    bioLteMax.in[0] <== biomarker;
    bioLteMax.in[1] <== maxBiomarker;

    // medicationX == requiredMedicationX
    component medEq = IsEqual();
    medEq.in[0] <== medicationX;
    medEq.in[1] <== requiredMedicationX;

    // countryCode == requiredCountryCode
    component countryEq = IsEqual();
    countryEq.in[0] <== countryCode;
    countryEq.in[1] <== requiredCountryCode;

    // pregnant != forbiddenPregnant  (i.e. pregnant is NOT the disqualifying value)
    component pregnantEq = IsEqual();
    pregnantEq.in[0] <== pregnant;
    pregnantEq.in[1] <== forbiddenPregnant;
    signal notPregnant;
    notPregnant <== 1 - pregnantEq.out;

    // conditionY != forbiddenConditionY
    component condEq = IsEqual();
    condEq.in[0] <== conditionY;
    condEq.in[1] <== forbiddenConditionY;
    signal noConditionY;
    noConditionY <== 1 - condEq.out;

    // Combine ALL predicates with AND (multiplication of 0/1 signals).
    signal a1;
    signal a2;
    signal a3;
    signal a4;
    signal a5;
    signal a6;
    signal a7;

    a1 <== ageGteMin.out * ageLteMax.out;
    a2 <== a1 * bioGteMin.out;
    a3 <== a2 * bioLteMax.out;
    a4 <== a3 * medEq.out;
    a5 <== a4 * countryEq.out;
    a6 <== a5 * notPregnant;
    a7 <== a6 * noConditionY;

    eligible <== a7;

    // trialId is bound into the public signal set so a proof cannot be
    // replayed against a different trial's parameters. It is intentionally
    // not used in the arithmetic above -- it just needs to be a public
    // input so it becomes part of what the verifier checks.
    signal trialIdEcho;
    trialIdEcho <== trialId * 1;

    // Hard requirement: the circuit only accepts a witness where the
    // combined predicate is true. This is what makes "the proof should
    // fail if any condition is false" real rather than cosmetic: if any
    // predicate above evaluates to 0, this constraint is unsatisfiable
    // and snarkjs's witness calculation throws, so no proof can ever be
    // generated for an ineligible participant.
    eligible === 1;
}

component main {public [minAge, maxAge, minBiomarker, maxBiomarker, requiredMedicationX, requiredCountryCode, forbiddenPregnant, forbiddenConditionY, trialId]} = Eligibility(32);
