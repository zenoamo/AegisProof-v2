namespace AegisProof

/-!
  AegisCommitCore Public Signal Specification

  Canonical public signal layout.

  IMPORTANT:

  This specification assumes the canonical 29-element
  publicSignals vector is:

    [0]  modelManifestCommitment
    [1]  executionEnvCommitment
    [2]  generationCommitment
    [3]  commitment
    [4]  nullifier
    [5]  expectedPromptRoot
    [6]  expectedOutputRoot
    [7]  sessionId
    [8]  purposeId
    [9]  weightsHash
    [10] tokenizerHash
    [11] systemPromptHash
    [12] loraHash
    [13] adapterHash
    [14] safetyLayerHash
    [15] quantizationHash
    [16] precisionHash
    [17] runtimeHash
    [18] driverHash
    [19] temperature
    [20] topP
    [21] topK
    [22] seed
    [23] repetitionPenalty
    [24] presencePenalty
    [25] frequencyPenalty
    [26] maxTokens
    [27] protocolVersion
    [28] timestamp
-/

-- ============================================================
-- Basic Types
-- ============================================================

abbrev Signal := Nat

abbrev Signals29 :=
  Fin 29 → Signal


-- ============================================================
-- Canonical Public Signal Indices
-- ============================================================

def MODEL_MANIFEST_COMMITMENT : Nat := 0
def EXECUTION_ENV_COMMITMENT : Nat := 1
def GENERATION_COMMITMENT : Nat := 2
def COMMITMENT : Nat := 3
def NULLIFIER : Nat := 4

def EXPECTED_PROMPT_ROOT : Nat := 5
def EXPECTED_OUTPUT_ROOT : Nat := 6

def SESSION_ID : Nat := 7
def PURPOSE_ID : Nat := 8

def WEIGHTS_HASH : Nat := 9
def TOKENIZER_HASH : Nat := 10
def SYSTEM_PROMPT_HASH : Nat := 11

def LORA_HASH : Nat := 12
def ADAPTER_HASH : Nat := 13
def SAFETY_LAYER_HASH : Nat := 14

def QUANTIZATION_HASH : Nat := 15
def PRECISION_HASH : Nat := 16
def RUNTIME_HASH : Nat := 17
def DRIVER_HASH : Nat := 18

def TEMPERATURE : Nat := 19
def TOP_P : Nat := 20
def TOP_K : Nat := 21
def SEED : Nat := 22

def REPETITION_PENALTY : Nat := 23
def PRESENCE_PENALTY : Nat := 24
def FREQUENCY_PENALTY : Nat := 25
def MAX_TOKENS : Nat := 26

def PROTOCOL_VERSION : Nat := 27
def TIMESTAMP : Nat := 28


-- ============================================================
-- Signal Count
-- ============================================================

def TOTAL_SIGNAL_COUNT : Nat := 29


-- ============================================================
-- Index Validation
-- ============================================================

theorem model_manifest_commitment_valid :
    MODEL_MANIFEST_COMMITMENT < TOTAL_SIGNAL_COUNT := by
  decide

theorem execution_env_commitment_valid :
    EXECUTION_ENV_COMMITMENT < TOTAL_SIGNAL_COUNT := by
  decide

theorem generation_commitment_valid :
    GENERATION_COMMITMENT < TOTAL_SIGNAL_COUNT := by
  decide

theorem commitment_valid :
    COMMITMENT < TOTAL_SIGNAL_COUNT := by
  decide

theorem nullifier_valid :
    NULLIFIER < TOTAL_SIGNAL_COUNT := by
  decide

theorem session_id_valid :
    SESSION_ID < TOTAL_SIGNAL_COUNT := by
  decide

theorem purpose_id_valid :
    PURPOSE_ID < TOTAL_SIGNAL_COUNT := by
  decide


-- ============================================================
-- Signal Accessors
-- ============================================================

def modelManifestCommitment
    (signals : Signals29) : Signal :=
  signals ⟨
    MODEL_MANIFEST_COMMITMENT,
    model_manifest_commitment_valid
  ⟩

def executionEnvCommitment
    (signals : Signals29) : Signal :=
  signals ⟨
    EXECUTION_ENV_COMMITMENT,
    execution_env_commitment_valid
  ⟩

def generationCommitment
    (signals : Signals29) : Signal :=
  signals ⟨
    GENERATION_COMMITMENT,
    generation_commitment_valid
  ⟩

def commitment
    (signals : Signals29) : Signal :=
  signals ⟨
    COMMITMENT,
    commitment_valid
  ⟩

def nullifier
    (signals : Signals29) : Signal :=
  signals ⟨
    NULLIFIER,
    nullifier_valid
  ⟩

def sessionId
    (signals : Signals29) : Signal :=
  signals ⟨
    SESSION_ID,
    session_id_valid
  ⟩

def purposeId
    (signals : Signals29) : Signal :=
  signals ⟨
    PURPOSE_ID,
    purpose_id_valid
  ⟩


-- ============================================================
-- Proof Binding
-- ============================================================

structure ProofBinding where
  signals : Signals29
  expectedSessionId : Signal
  expectedPurposeId : Signal


-- ============================================================
-- Session Binding
-- ============================================================

def sessionBindingValid
    (binding : ProofBinding) : Prop :=
  sessionId binding.signals =
  binding.expectedSessionId


theorem valid_session_binding
    (binding : ProofBinding)
    (h :
      sessionId binding.signals =
      binding.expectedSessionId) :
    sessionBindingValid binding := by
  exact h


-- ============================================================
-- Purpose Binding
-- ============================================================

def purposeBindingValid
    (binding : ProofBinding) : Prop :=
  purposeId binding.signals =
  binding.expectedPurposeId


theorem valid_purpose_binding
    (binding : ProofBinding)
    (h :
      purposeId binding.signals =
      binding.expectedPurposeId) :
    purposeBindingValid binding := by
  exact h


-- ============================================================
-- Combined Proof Binding
-- ============================================================

def proofBindingValid
    (binding : ProofBinding) : Prop :=
  sessionBindingValid binding ∧
  purposeBindingValid binding


theorem valid_proof_binding
    (binding : ProofBinding)
    (hSession :
      sessionId binding.signals =
      binding.expectedSessionId)
    (hPurpose :
      purposeId binding.signals =
      binding.expectedPurposeId) :
    proofBindingValid binding := by
  constructor
  · exact hSession
  · exact hPurpose


-- ============================================================
-- Critical Index Separation
-- ============================================================

theorem session_id_ne_purpose_id :
    SESSION_ID ≠ PURPOSE_ID := by
  decide

theorem session_id_ne_commitment :
    SESSION_ID ≠ COMMITMENT := by
  decide

theorem session_id_ne_nullifier :
    SESSION_ID ≠ NULLIFIER := by
  decide

theorem purpose_id_ne_commitment :
    PURPOSE_ID ≠ COMMITMENT := by
  decide

theorem purpose_id_ne_nullifier :
    PURPOSE_ID ≠ NULLIFIER := by
  decide

theorem commitment_ne_nullifier :
    COMMITMENT ≠ NULLIFIER := by
  decide


-- ============================================================
-- Value Separation
-- ============================================================

def commitmentNullifierValueSeparated
    (signals : Signals29) : Prop :=
  commitment signals ≠ nullifier signals


-- ============================================================
-- Solidity Signal Accessors
-- ============================================================

def soliditySessionId
    (signals : Signals29) : Signal :=
  signals ⟨7, by decide⟩

def solidityPurposeId
    (signals : Signals29) : Signal :=
  signals ⟨8, by decide⟩

def solidityCommitment
    (signals : Signals29) : Signal :=
  signals ⟨3, by decide⟩

def solidityNullifier
    (signals : Signals29) : Signal :=
  signals ⟨4, by decide⟩


-- ============================================================
-- Circom ↔ Solidity Agreement
-- ============================================================

theorem circom_solidity_session_id_agree
    (signals : Signals29) :
    sessionId signals =
    soliditySessionId signals := by
  rfl

theorem circom_solidity_purpose_id_agree
    (signals : Signals29) :
    purposeId signals =
    solidityPurposeId signals := by
  rfl

theorem circom_solidity_commitment_agree
    (signals : Signals29) :
    commitment signals =
    solidityCommitment signals := by
  rfl

theorem circom_solidity_nullifier_agree
    (signals : Signals29) :
    nullifier signals =
    solidityNullifier signals := by
  rfl


-- ============================================================
-- Canonical Index Assertions
-- ============================================================

theorem canonical_session_id_index :
    SESSION_ID = 7 := by
  rfl

theorem canonical_purpose_id_index :
    PURPOSE_ID = 8 := by
  rfl

theorem canonical_commitment_index :
    COMMITMENT = 3 := by
  rfl

theorem canonical_nullifier_index :
    NULLIFIER = 4 := by
  rfl


-- ============================================================
-- Total Signal Count
-- ============================================================

theorem canonical_total_signal_count :
    TOTAL_SIGNAL_COUNT = 29 := by
  rfl

end AegisProof