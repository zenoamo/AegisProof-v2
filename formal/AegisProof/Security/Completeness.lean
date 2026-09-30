import AegisProof.Core.ProofSemantics

namespace AegisProof.Security

open AegisProof.Core

/--
Completeness contract for the abstract verifier.

This states the semantic side only; the concrete Groth16
implementation is verified separately against this contract.
-/
def CompletenessContract : Prop :=
  ∀ (proof : Proof),
    Verifies proof VerificationResult.valid

/--
The abstract valid-result semantics satisfy the completeness
contract by construction.
-/
theorem completeness_contract :
    ∀ (proof : Proof),
      Verifies proof VerificationResult.valid := by
  intro proof
  exact verifies_valid proof

end AegisProof.Security