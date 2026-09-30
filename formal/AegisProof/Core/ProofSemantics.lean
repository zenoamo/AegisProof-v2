import AegisProof.Core.PublicSignals

namespace AegisProof.Core

/--
Abstract proof object.

The actual Groth16 proof remains in the production stack.
Lean reasons about the semantic contract surrounding it.
-/
structure Proof where
  publicSignals : PublicSignals
  proofBytes : List Nat

/-- Abstract verifier result. -/
inductive VerificationResult
  | valid
  | invalid
  deriving Repr, DecidableEq

/--
Abstract verification relation.

For the initial formal layer, verification is represented as an
explicit proposition rather than reimplementing Groth16.
-/
def Verifies
    (proof : Proof)
    (result : VerificationResult) : Prop :=
  result = VerificationResult.valid

/-- A valid result is equivalent to the proposition being satisfied. -/
theorem verifies_valid
    (proof : Proof) :
    Verifies proof VerificationResult.valid := by
  rfl

/-- Invalid results cannot satisfy the verification relation. -/
theorem verifies_invalid_false
    (proof : Proof) :
    ¬ Verifies proof VerificationResult.invalid := by
  intro h
  cases h

/--
Proof semantics preserve the public-signal object itself.
-/
def publicSignalsOf (proof : Proof) : PublicSignals :=
  proof.publicSignals

theorem publicSignals_roundtrip (proof : Proof) :
    publicSignalsOf proof = proof.publicSignals := by
  rfl

end AegisProof.Core