namespace AegisProof.TEE

/--
Claims supplied by the experimental TEE adapter.
-/
structure Claims where
  measurement : String
  payload : String

/--
The ClaimsGate is deliberately modeled as an external boundary.
-/
structure ClaimsGate where
  accepted : Claims → Bool

/--
A claims gate does not itself modify Frozen Core state.
This is represented by a separate function boundary.
-/
def passThrough
    (gate : ClaimsGate)
    (claims : Claims) :
    Option Claims :=
  if gate.accepted claims then
    some claims
  else
    none

/-- Accepted claims are preserved exactly across the gate. -/
theorem passThrough_preserves_claims
    (gate : ClaimsGate)
    (claims : Claims)
    (h : gate.accepted claims = true) :
    passThrough gate claims = some claims := by
  simp [passThrough, h]

/--
Rejected claims never cross the modeled gate.
-/
theorem passThrough_rejects
    (gate : ClaimsGate)
    (claims : Claims)
    (h : gate.accepted claims = false) :
    passThrough gate claims = none := by
  simp [passThrough, h]

end AegisProof.TEE