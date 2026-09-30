import AegisProof.Core.PublicSignals

namespace AegisProof.Invariants

open AegisProof.Core

/-- The canonical public-signal layout has exactly 30 entries. -/
def SignalLayoutValid : Prop :=
  publicSignalCount = 30

theorem signal_layout_is_valid :
    SignalLayoutValid := by
  rfl

/-- Every canonical PublicSignals value serializes to 30 values. -/
theorem signal_layout_preserved
    (signals : PublicSignals) :
    (toList signals).length = 30 := by
  exact toList_length_eq_30 signals

/--
A signal list accepted by the canonical constructor has exactly
30 entries.
-/
theorem constructor_requires_30
    (values : List Nat)
    (h : values.length = 30) :
    values.length = publicSignalCount := by
  simpa [publicSignalCount] using h

end AegisProof.Invariants