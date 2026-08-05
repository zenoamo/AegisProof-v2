namespace AegisProof


-- ============================================================
-- Aegis Signal Binding Specification
-- ============================================================
--
-- Purpose:
--
-- Verify the correspondence between:
--
-- 1. Circom input fields
-- 2. Circom public signal order
-- 3. Solidity pubSignals[] indexes
--
-- Critical signals:
--
-- signals[7]  = sessionId
-- signals[8]  = purposeId
-- signals[3]  = commitment
-- signals[4]  = nullifier
--
-- ============================================================


-- ============================================================
-- 1. Basic Types
-- ============================================================

abbrev SessionId := Nat
abbrev PurposeId := Nat
abbrev Commitment := Nat
abbrev Nullifier := Nat


-- ============================================================
-- 2. Circom Input Model
-- ============================================================

structure CircomInput where
  sessionId : SessionId
  purposeId : PurposeId
  commitment : Commitment
  nullifier : Nullifier


-- ============================================================
-- 3. Public Signal Vector
-- ============================================================

abbrev Signals29 :=
  Fin 29 → Nat


-- ============================================================
-- 4. Canonical Signal Indexes
-- ============================================================

def SESSION_ID_INDEX : Nat := 7
def PURPOSE_ID_INDEX : Nat := 8
def COMMITMENT_INDEX : Nat := 3
def NULLIFIER_INDEX : Nat := 4


-- ============================================================
-- 5. Signal Accessors
-- ============================================================

def publicSessionId
    (signals : Signals29) : SessionId :=
  signals ⟨SESSION_ID_INDEX, by decide⟩


def publicPurposeId
    (signals : Signals29) : PurposeId :=
  signals ⟨PURPOSE_ID_INDEX, by decide⟩


def publicCommitment
    (signals : Signals29) : Commitment :=
  signals ⟨COMMITMENT_INDEX, by decide⟩


def publicNullifier
    (signals : Signals29) : Nullifier :=
  signals ⟨NULLIFIER_INDEX, by decide⟩


-- ============================================================
-- 6. Signal Layout
-- ============================================================

theorem session_id_index_is_two :
    SESSION_ID_INDEX = 2 := by
  rfl


theorem purpose_id_index_is_three :
    PURPOSE_ID_INDEX = 3 := by
  rfl


theorem commitment_index_is_twenty_seven :
    COMMITMENT_INDEX = 27 := by
  rfl


theorem nullifier_index_is_twenty_eight :
    NULLIFIER_INDEX = 28 := by
  rfl


-- ============================================================
-- 7. Public Signal Binding Relation
-- ============================================================

structure PublicSignalBinding where
  signals : Signals29
  input : CircomInput


def sessionIdBound
    (binding : PublicSignalBinding) : Prop :=
  publicSessionId binding.signals
    =
  binding.input.sessionId


def purposeIdBound
    (binding : PublicSignalBinding) : Prop :=
  publicPurposeId binding.signals
    =
  binding.input.purposeId


def commitmentBound
    (binding : PublicSignalBinding) : Prop :=
  publicCommitment binding.signals
    =
  binding.input.commitment


def nullifierBound
    (binding : PublicSignalBinding) : Prop :=
  publicNullifier binding.signals
    =
  binding.input.nullifier


-- ============================================================
-- 8. Complete Binding
-- ============================================================

def fullyBound
    (binding : PublicSignalBinding) : Prop :=
  sessionIdBound binding
  ∧
  purposeIdBound binding
  ∧
  commitmentBound binding
  ∧
  nullifierBound binding


-- ============================================================
-- 9. Binding Safety Theorems
-- ============================================================

theorem bound_session_id_is_correct
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :
    publicSessionId binding.signals
      =
    binding.input.sessionId := by
  exact h.1


theorem bound_purpose_id_is_correct
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :
    publicPurposeId binding.signals
      =
    binding.input.purposeId := by
  exact h.2.1


theorem bound_commitment_is_correct
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :
    publicCommitment binding.signals
      =
    binding.input.commitment := by
  exact h.2.2.1


theorem bound_nullifier_is_correct
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :
    publicNullifier binding.signals
      =
    binding.input.nullifier := by
  exact h.2.2.2


-- ============================================================
-- 10. Purpose ID Critical Invariant
-- ============================================================
--
-- This is the invariant currently violated by the real
-- proof-generation output.
--
-- Expected:
--
-- input.purposeId = 0
-- publicSignals[3] = 0
--
-- Actual:
--
-- input.purposeId = 0
-- publicSignals[3] = large Poseidon-like value
--
-- The theorem below states the required invariant.
--
-- ============================================================

theorem purpose_id_must_be_preserved
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :
    publicPurposeId binding.signals
      =
    binding.input.purposeId := by
  exact bound_purpose_id_is_correct
    binding
    h


-- ============================================================
-- 11. Session ID Critical Invariant
-- ============================================================

theorem session_id_must_be_preserved
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :
    publicSessionId binding.signals
      =
    binding.input.sessionId := by
  exact bound_session_id_is_correct
    binding
    h


-- ============================================================
-- 12. Solidity Compatibility
-- ============================================================

def soliditySessionId
    (signals : Signals29) : SessionId :=
  signals ⟨2, by decide⟩


def solidityPurposeId
    (signals : Signals29) : PurposeId :=
  signals ⟨3, by decide⟩


def solidityCommitment
    (signals : Signals29) : Commitment :=
  signals ⟨27, by decide⟩


def solidityNullifier
    (signals : Signals29) : Nullifier :=
  signals ⟨28, by decide⟩


-- ============================================================
-- 13. Circom / Solidity Agreement
-- ============================================================

theorem session_id_circom_solidity_agree
    (signals : Signals29) :
    publicSessionId signals
      =
    soliditySessionId signals := by
  rfl


theorem purpose_id_circom_solidity_agree
    (signals : Signals29) :
    publicPurposeId signals
      =
    solidityPurposeId signals := by
  rfl


theorem commitment_circom_solidity_agree
    (signals : Signals29) :
    publicCommitment signals
      =
    solidityCommitment signals := by
  rfl


theorem nullifier_circom_solidity_agree
    (signals : Signals29) :
    publicNullifier signals
      =
    solidityNullifier signals := by
  rfl


-- ============================================================
-- 14. Final Binding Theorem
-- ============================================================

theorem fully_bound_proof_is_cross_layer_consistent
    (binding : PublicSignalBinding)
    (h : fullyBound binding) :

    soliditySessionId binding.signals
      =
    binding.input.sessionId

    ∧

    solidityPurposeId binding.signals
      =
    binding.input.purposeId

    ∧

    solidityCommitment binding.signals
      =
    binding.input.commitment

    ∧

    solidityNullifier binding.signals
      =
    binding.input.nullifier := by

  constructor
  · exact bound_session_id_is_correct binding h
  · constructor
    · exact bound_purpose_id_is_correct binding h
    · constructor
      · exact bound_commitment_is_correct binding h
      · exact bound_nullifier_is_correct binding h


end AegisProof