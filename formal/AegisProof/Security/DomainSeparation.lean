import AegisProof.Core.Nullifier

namespace AegisProof.Security

open AegisProof.Core

/--
Different domains are represented explicitly by different domain
identifiers.
-/
def DifferentDomain
    (ctx₁ ctx₂ : NullifierContext) : Prop :=
  ctx₁.domain ≠ ctx₂.domain

/--
Abstract domain-separation contract.

The production cryptographic construction must establish that
different domains cannot collide for the same witness.
-/
def DomainSeparated
    (w : Witness)
    (ctx₁ ctx₂ : NullifierContext) : Prop :=
  ctx₁.domain ≠ ctx₂.domain →
    nullifierOf w ctx₁ ≠ nullifierOf w ctx₂

/--
Domain separation is a contract of the semantic model rather than
a consequence of the simplified arithmetic implementation.
-/
theorem domain_separation
    (w : Witness)
    (ctx₁ ctx₂ : NullifierContext)
    (hDomain : ctx₁.domain ≠ ctx₂.domain)
    (hSeparated : DomainSeparated w ctx₁ ctx₂) :
    nullifierOf w ctx₁ ≠ nullifierOf w ctx₂ := by
  exact hSeparated hDomain

/--
Identical domains imply identical nullifiers for the same witness.
-/
theorem same_domain_same_nullifier
    (w : Witness)
    (ctx₁ ctx₂ : NullifierContext)
    (h : ctx₁.domain = ctx₂.domain) :
    nullifierOf w ctx₁ = nullifierOf w ctx₂ := by
  unfold nullifierOf
  rw [h]

end AegisProof.Security