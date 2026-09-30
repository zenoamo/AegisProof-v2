import AegisProof.Core.Nullifier
import AegisProof.Core.PublicSignals

namespace AegisProof.Invariants

open AegisProof.Core

/--
The second public signal is modeled as the nullifier.
-/
def NullifierBound
    (w : Witness)
    (ctx : NullifierContext)
    (signals : PublicSignals) : Prop :=
  signals.signal02 = nullifierOf w ctx

/-- Bind a nullifier into the canonical signal position. -/
def bindNullifier
    (w : Witness)
    (ctx : NullifierContext)
    (signals : PublicSignals) : PublicSignals :=
  {
    signals with
    signal02 := nullifierOf w ctx
  }

/-- Nullifier binding is preserved by construction. -/
theorem bindNullifier_valid
    (w : Witness)
    (ctx : NullifierContext)
    (signals : PublicSignals) :
    NullifierBound w ctx (bindNullifier w ctx signals) := by
  rfl

/--
Equal witnesses and equal contexts yield equal bound nullifiers.
-/
theorem nullifier_binding_consistent
    (w₁ w₂ : Witness)
    (ctx₁ ctx₂ : NullifierContext)
    (s₁ s₂ : PublicSignals)
    (hw : w₁ = w₂)
    (hc : ctx₁ = ctx₂)
    (h₁ : NullifierBound w₁ ctx₁ s₁)
    (h₂ : NullifierBound w₂ ctx₂ s₂) :
    s₁.signal02 = s₂.signal02 := by
  have hNullifier :
      nullifierOf w₁ ctx₁ = nullifierOf w₂ ctx₂ := by
    cases hw
    cases hc
    rfl

  exact Eq.trans h₁ (Eq.trans hNullifier h₂.symm)

end AegisProof.Invariants