import AegisProof.Core.Commitment

namespace AegisProof.Core

/--
Domain/context used when deriving a nullifier.

The domain is modeled explicitly so that domain separation becomes
a first-class formal property.
-/
structure NullifierContext where
  domain : Nat

/-- Abstract nullifier value. -/
def Nullifier :=
  Nat

/--
Abstract nullifier derivation.

This is a semantic model, not the production cryptographic primitive.
-/
def nullifierOf
    (w : Witness)
    (ctx : NullifierContext) : Nullifier :=
  w.secret + ctx.domain

/-- Nullifier derivation is deterministic. -/
theorem nullifier_deterministic
    (w : Witness)
    (ctx : NullifierContext) :
    nullifierOf w ctx = nullifierOf w ctx := by
  rfl

/-- Equal witnesses and equal domains imply equal nullifiers. -/
theorem nullifier_congruent
    (w₁ w₂ : Witness)
    (ctx₁ ctx₂ : NullifierContext)
    (hw : w₁ = w₂)
    (hc : ctx₁ = ctx₂) :
    nullifierOf w₁ ctx₁ = nullifierOf w₂ ctx₂ := by
  cases hw
  cases hc
  rfl

end AegisProof.Core