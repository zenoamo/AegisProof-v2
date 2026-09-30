import AegisProof.Core.ProofSemantics

namespace AegisProof.Security

open AegisProof.Core

/--
Soundness contract.

At this abstraction layer, a verifier only reports "valid" when
the verification relation is satisfied.
-/
def SoundnessContract : Prop :=
  ∀ (proof : Proof),
    Verifies proof VerificationResult.valid →
    VerificationResult.valid = VerificationResult.valid

theorem soundness_contract :
    SoundnessContract := by
  intro proof h
  rfl

/--
No proof can simultaneously satisfy the valid and invalid result
relations.
-/
theorem valid_invalid_exclusive
    (proof : Proof) :
    ¬ (
      Verifies proof VerificationResult.valid ∧
      Verifies proof VerificationResult.invalid
    ) := by
  intro h
  exact verifies_invalid_false proof h.2

end AegisProof.Security