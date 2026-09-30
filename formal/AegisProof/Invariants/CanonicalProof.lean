import AegisProof.Core.ProofSemantics

namespace AegisProof.Invariants

open AegisProof.Core

/--
The canonical proof path is represented explicitly.

This does not implement proveCanonical().
It defines the semantic contract that a canonical proof must satisfy.
-/
structure CanonicalProof where
  proof : Proof
  canonical : Bool

def IsCanonical
    (p : CanonicalProof) : Prop :=
  p.canonical = true

/-- Construct a canonical wrapper around a proof. -/
def markCanonical (proof : Proof) : CanonicalProof :=
  {
    proof := proof
    canonical := true
  }

/-- markCanonical produces a canonical proof. -/
theorem markCanonical_valid
    (proof : Proof) :
    IsCanonical (markCanonical proof) := by
  rfl

/--
A canonical proof retains its original public signals.
-/
theorem canonical_preserves_signals
    (proof : Proof) :
    (markCanonical proof).proof.publicSignals = proof.publicSignals := by
  rfl

end AegisProof.Invariants