namespace AegisProof

/-
  AegisShield Formal Specification

  This file models the core state-machine invariants of AegisShield.

  It intentionally does not model:
    - Groth16 cryptography
    - EVM execution
    - Solidity storage layout

  Instead, it formalizes the protocol-level properties that
  the Solidity contract is expected to preserve.
-/

-- ============================================================
-- Basic Types
-- ============================================================

abbrev SessionId := Nat
abbrev PurposeId := Nat
abbrev Nullifier := Nat
abbrev Commitment := Nat
abbrev Address := Nat

-- ============================================================
-- Constants
-- ============================================================

def operator : Address := 1

def allowedPurpose (purposeId : PurposeId) : Prop :=
  purposeId ≤ 5

-- ============================================================
-- Session
-- ============================================================

structure Session where
  purposeId : PurposeId
  active : Bool
deriving DecidableEq, Repr

-- ============================================================
-- AegisShield State
-- ============================================================

structure State where
  sessionExists : SessionId → Bool
  sessions : SessionId → Session
  usedNullifiers : Nullifier → Bool
deriving Repr

-- ============================================================
-- Initial State
-- ============================================================

def emptySession : Session :=
  {
    purposeId := 0
    active := false
  }

def initialState : State :=
  {
    sessionExists := fun _ => false
    sessions := fun _ => emptySession
    usedNullifiers := fun _ => false
  }

-- ============================================================
-- Session Registration
-- ============================================================

def registerSession
    (s : State)
    (caller : Address)
    (sessionId : SessionId)
    (purposeId : PurposeId)
    : Option State :=

  if caller ≠ operator then
    none
  else if s.sessionExists sessionId then
    none
  else if ¬ allowedPurpose purposeId then
    none
  else
    some
      {
        sessionExists :=
          fun id =>
            if id = sessionId then
              true
            else
              s.sessionExists id

        sessions :=
          fun id =>
            if id = sessionId then
              {
                purposeId := purposeId
                active := true
              }
            else
              s.sessions id

        usedNullifiers :=
          s.usedNullifiers
      }

-- ============================================================
-- Session Deactivation
-- ============================================================

def deactivateSession
    (s : State)
    (caller : Address)
    (sessionId : SessionId)
    : Option State :=

  if caller ≠ operator then
    none
  else if ¬ s.sessionExists sessionId then
    none
  else if ¬ (s.sessions sessionId).active then
    none
  else
    some
      {
        sessionExists :=
          s.sessionExists

        sessions :=
          fun id =>
            if id = sessionId then
              {
                purposeId :=
                  (s.sessions id).purposeId

                active := false
              }
            else
              s.sessions id

        usedNullifiers :=
          s.usedNullifiers
      }

-- ============================================================
-- Proof
-- ============================================================

structure Proof where
  sessionId : SessionId
  purposeId : PurposeId
  commitment : Commitment
  nullifier : Nullifier
deriving DecidableEq, Repr

-- ============================================================
-- Proof Acceptance
-- ============================================================

def verifyAndAccept
    (s : State)
    (caller : Address)
    (proof : Proof)
    (expectedSessionId : SessionId)
    : Option State :=

  if caller ≠ operator then
    none
  else if proof.sessionId ≠ expectedSessionId then
    none
  else if ¬ s.sessionExists proof.sessionId then
    none
  else if ¬ (s.sessions proof.sessionId).active then
    none
  else if
    (s.sessions proof.sessionId).purposeId
      ≠ proof.purposeId then
    none
  else if s.usedNullifiers proof.nullifier then
    none
  else
    some
      {
        sessionExists :=
          s.sessionExists

        sessions :=
          s.sessions

        usedNullifiers :=
          fun n =>
            if n = proof.nullifier then
              true
            else
              s.usedNullifiers n
      }

-- ============================================================
-- Theorem 1
-- Unauthorized Registration Is Rejected
-- ============================================================

theorem unauthorized_registration_rejected
    (s : State)
    (caller : Address)
    (sessionId : SessionId)
    (purposeId : PurposeId)
    (h : caller ≠ operator) :
    registerSession s caller sessionId purposeId = none := by
  simp [registerSession, h]

-- ============================================================
-- Theorem 2
-- Unauthorized Deactivation Is Rejected
-- ============================================================

theorem unauthorized_deactivation_rejected
    (s : State)
    (caller : Address)
    (sessionId : SessionId)
    (h : caller ≠ operator) :
    deactivateSession s caller sessionId = none := by
  simp [deactivateSession, h]

-- ============================================================
-- Theorem 3
-- Unauthorized Proof Acceptance Is Rejected
-- ============================================================

theorem unauthorized_proof_rejected
    (s : State)
    (caller : Address)
    (proof : Proof)
    (expectedSessionId : SessionId)
    (h : caller ≠ operator) :
    verifyAndAccept
      s
      caller
      proof
      expectedSessionId
      = none := by
  simp [verifyAndAccept, h]

-- ============================================================
-- Theorem 4
-- Session ID Mismatch Is Rejected
-- ============================================================

theorem session_mismatch_rejected
    (s : State)
    (proof : Proof)
    (expectedSessionId : SessionId)
    (h : proof.sessionId ≠ expectedSessionId) :
    verifyAndAccept
      s
      operator
      proof
      expectedSessionId
      = none := by
  simp [verifyAndAccept, h]

-- ============================================================
-- Theorem 5
-- Unknown Session Is Rejected
-- ============================================================

theorem unknown_session_rejected
    (s : State)
    (proof : Proof)
    (h : ¬ s.sessionExists proof.sessionId) :
    verifyAndAccept
      s
      operator
      proof
      proof.sessionId
      = none := by
  simp [verifyAndAccept, h]

-- ============================================================
-- Theorem 6
-- Inactive Session Is Rejected
-- ============================================================

theorem inactive_session_rejected
    (s : State)
    (proof : Proof)
    (hExists : s.sessionExists proof.sessionId)
    (hInactive :
      ¬ (s.sessions proof.sessionId).active) :
    verifyAndAccept
      s
      operator
      proof
      proof.sessionId
      = none := by
  simp [
    verifyAndAccept,
    hExists,
    hInactive
  ]

-- ============================================================
-- Theorem 7
-- Purpose Mismatch Is Rejected
-- ============================================================

theorem purpose_mismatch_rejected
    (s : State)
    (proof : Proof)
    (hExists : s.sessionExists proof.sessionId)
    (hActive :
      (s.sessions proof.sessionId).active)
    (hMismatch :
      (s.sessions proof.sessionId).purposeId
        ≠ proof.purposeId) :
    verifyAndAccept
      s
      operator
      proof
      proof.sessionId
      = none := by
  simp [
    verifyAndAccept,
    hExists,
    hActive,
    hMismatch
  ]

-- ============================================================
-- Theorem 8
-- Nullifier Replay Is Rejected
-- ============================================================

theorem nullifier_replay_rejected
    (s : State)
    (proof : Proof)
    (hExists : s.sessionExists proof.sessionId)
    (hActive :
      (s.sessions proof.sessionId).active)
    (hPurpose :
      (s.sessions proof.sessionId).purposeId
        = proof.purposeId)
    (hUsed :
      s.usedNullifiers proof.nullifier) :
    verifyAndAccept
      s
      operator
      proof
      proof.sessionId
      = none := by
  simp [
    verifyAndAccept,
    hExists,
    hActive,
    hPurpose,
    hUsed
  ]

-- ============================================================
-- Theorem 9
-- Session ID Cannot Be Re-Registered
-- ============================================================

theorem session_reregistration_rejected
    (s : State)
    (sessionId : SessionId)
    (purposeId : PurposeId)
    (hExists : s.sessionExists sessionId) :
    registerSession
      s
      operator
      sessionId
      purposeId
      = none := by
  simp [
    registerSession,
    hExists
  ]

-- ============================================================
-- Theorem 10
-- Successful Proof Acceptance Marks Nullifier Used
-- ============================================================

theorem accepted_proof_marks_nullifier
    (s : State)
    (proof : Proof)
    (hExists : s.sessionExists proof.sessionId)
    (hActive :
      (s.sessions proof.sessionId).active)
    (hPurpose :
      (s.sessions proof.sessionId).purposeId
        = proof.purposeId)
    (hUnused :
      ¬ s.usedNullifiers proof.nullifier) :
    ∃ s',
      verifyAndAccept
        s
        operator
        proof
        proof.sessionId
        = some s'
      ∧
      s'.usedNullifiers proof.nullifier = true := by

  simp [
    verifyAndAccept,
    hExists,
    hActive,
    hPurpose,
    hUnused
  ]

  exact ⟨_, rfl⟩

-- ============================================================
-- Theorem 11
-- Deactivation Makes Session Inactive
-- ============================================================

theorem successful_deactivation_makes_inactive
    (s : State)
    (sessionId : SessionId)
    (hExists :
      s.sessionExists sessionId)
    (hActive :
      (s.sessions sessionId).active) :
    ∃ s',
      deactivateSession
        s
        operator
        sessionId
        = some s'
      ∧
      ¬ (s'.sessions sessionId).active := by

  simp [
    deactivateSession,
    hExists,
    hActive
  ]

  exact ⟨_, rfl⟩

-- ============================================================
-- Theorem 12
-- Registered Session Is Active
-- ============================================================

theorem successful_registration_creates_active_session
    (s : State)
    (sessionId : SessionId)
    (purposeId : PurposeId)
    (hNotExists :
      ¬ s.sessionExists sessionId)
    (hPurpose :
      allowedPurpose purposeId) :
    ∃ s',
      registerSession
        s
        operator
        sessionId
        purposeId
        = some s'
      ∧
      s'.sessionExists sessionId
      ∧
      (s'.sessions sessionId).active
      ∧
      (s'.sessions sessionId).purposeId
        = purposeId := by

  simp [
    registerSession,
    hNotExists,
    hPurpose
  ]

  exact ⟨_, rfl, rfl, rfl⟩

end AegisShield

