import AegisProof.Core.ProofSemantics

namespace AegisProof.Security

open AegisProof.Core

/--
Semantic notion of proof identity for the initial formal model.
-/
def SameStatement
    (p₁ p₂ : Proof) : Prop :=
  p₁.publicSignals = p₂.publicSignals

/--
A canonical transformation is statement-preserving.
-/
def StatementPreserving
    (transform : Proof → Proof) : Prop :=
  ∀ p, SameStatement p (transform p)

/-- Identity transformation preserves the statement. -/
theorem identity_statement_preserving :
    StatementPreserving (fun p => p) := by
  intro p
  rfl

/--
If a transformation is statement-preserving, public signals remain
unchanged.
-/
theorem statement_preserving_signals
    (transform : Proof → Proof)
    (h : StatementPreserving transform)
    (p : Proof) :
    (transform p).publicSignals = p.publicSignals := by
  exact (h p).symm

end AegisProof.Security