import AegisProof.Core.PublicSignals
import AegisProof.Invariants.SignalLayout

namespace AegisProof.Invariants

open AegisProof.Core

/--
Formal representation of the frozen-core contract.

These fields model architectural invariants rather than concrete
cryptographic implementations.
-/
structure FrozenCoreSpec where
  publicSignalCount : Nat
  canonicalProofEnabled : Bool
  teeIsolationRequired : Bool
  t1ToT9Required : Bool

/--
Frozen Core validity contract.
-/
def FrozenCoreValid (spec : FrozenCoreSpec) : Prop :=
  spec.publicSignalCount = 30 ∧
  spec.canonicalProofEnabled = true ∧
  spec.teeIsolationRequired = true ∧
  spec.t1ToT9Required = true

/-- Canonical Frozen Core specification. -/
def canonicalFrozenCore : FrozenCoreSpec :=
  {
    publicSignalCount := 30
    canonicalProofEnabled := true
    teeIsolationRequired := true
    t1ToT9Required := true
  }

/-- The canonical Frozen Core satisfies the formal contract. -/
theorem canonicalFrozenCore_valid :
    FrozenCoreValid canonicalFrozenCore := by
  constructor
  · rfl
  constructor
  · rfl
  constructor
  · rfl
  · rfl

/--
The Frozen Core signal count agrees with the public-signal layout.
-/
theorem frozenCore_signal_layout_agrees :
    canonicalFrozenCore.publicSignalCount = publicSignalCount := by
  rfl

end AegisProof.Invariants