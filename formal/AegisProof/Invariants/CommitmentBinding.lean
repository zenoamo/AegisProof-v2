import AegisProof.Core.Commitment
import AegisProof.Core.PublicSignals

namespace AegisProof.Invariants

open AegisProof.Core

/--
A public signal set is commitment-bound when its first signal equals
the commitment derived from the witness.
-/
def CommitmentBound
    (w : Witness)
    (signals : PublicSignals) : Prop :=
  signals.signal01 = commitmentOf w

/-- A freshly constructed signal set can be bound to a witness. -/
def bindCommitment
    (w : Witness)
    (signals : PublicSignals) : PublicSignals :=
  {
    signals with
    signal01 := commitmentOf w
  }

/-- Binding establishes the commitment invariant. -/
theorem bindCommitment_valid
    (w : Witness)
    (signals : PublicSignals) :
    CommitmentBound w (bindCommitment w signals) := by
  rfl

/--
If two signal sets are commitment-bound to the same witness,
their commitment fields are equal.
-/
theorem commitment_binding_unique
    (w : Witness)
    (s₁ s₂ : PublicSignals)
    (h₁ : CommitmentBound w s₁)
    (h₂ : CommitmentBound w s₂) :
    s₁.signal01 = s₂.signal01 := by
  exact Eq.trans h₁ h₂.symm

end AegisProof.Invariants