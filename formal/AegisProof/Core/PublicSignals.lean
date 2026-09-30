namespace AegisProof.Core

/--
AegisProof v2 frozen public-signal layout.

The protocol exposes exactly 30 public signals.
The semantic meaning of individual signals can be refined later
without changing the cardinality invariant.
-/
structure PublicSignals where
  signal01 : Nat
  signal02 : Nat
  signal03 : Nat
  signal04 : Nat
  signal05 : Nat
  signal06 : Nat
  signal07 : Nat
  signal08 : Nat
  signal09 : Nat
  signal10 : Nat
  signal11 : Nat
  signal12 : Nat
  signal13 : Nat
  signal14 : Nat
  signal15 : Nat
  signal16 : Nat
  signal17 : Nat
  signal18 : Nat
  signal19 : Nat
  signal20 : Nat
  signal21 : Nat
  signal22 : Nat
  signal23 : Nat
  signal24 : Nat
  signal25 : Nat
  signal26 : Nat
  signal27 : Nat
  signal28 : Nat
  signal29 : Nat
  signal30 : Nat

/-- The frozen number of public signals. -/
def publicSignalCount : Nat :=
  30

theorem publicSignalCount_eq_30 :
    publicSignalCount = 30 := by
  rfl

/--
Canonical serialization order.

This is deliberately explicit so that the ordering itself can be
reasoned about independently from any concrete JSON/ABI encoding.
-/
def toList (s : PublicSignals) : List Nat :=
  [
    s.signal01,
    s.signal02,
    s.signal03,
    s.signal04,
    s.signal05,
    s.signal06,
    s.signal07,
    s.signal08,
    s.signal09,
    s.signal10,
    s.signal11,
    s.signal12,
    s.signal13,
    s.signal14,
    s.signal15,
    s.signal16,
    s.signal17,
    s.signal18,
    s.signal19,
    s.signal20,
    s.signal21,
    s.signal22,
    s.signal23,
    s.signal24,
    s.signal25,
    s.signal26,
    s.signal27,
    s.signal28,
    s.signal29,
    s.signal30
  ]

theorem toList_length (s : PublicSignals) :
    (toList s).length = publicSignalCount := by
  simp [toList, publicSignalCount]

theorem toList_length_eq_30 (s : PublicSignals) :
    (toList s).length = 30 := by
  simp [toList, publicSignalCount]

/--
Construct a PublicSignals value from exactly 30 values.
-/
def ofList
    (values : List Nat)
    (h : values.length = 30) : Option PublicSignals :=

  match values with
  | [
      a01, a02, a03, a04, a05,
      a06, a07, a08, a09, a10,
      a11, a12, a13, a14, a15,
      a16, a17, a18, a19, a20,
      a21, a22, a23, a24, a25,
      a26, a27, a28, a29, a30
    ] =>
      some {
        signal01 := a01
        signal02 := a02
        signal03 := a03
        signal04 := a04
        signal05 := a05
        signal06 := a06
        signal07 := a07
        signal08 := a08
        signal09 := a09
        signal10 := a10
        signal11 := a11
        signal12 := a12
        signal13 := a13
        signal14 := a14
        signal15 := a15
        signal16 := a16
        signal17 := a17
        signal18 := a18
        signal19 := a19
        signal20 := a20
        signal21 := a21
        signal22 := a22
        signal23 := a23
        signal24 := a24
        signal25 := a25
        signal26 := a26
        signal27 := a27
        signal28 := a28
        signal29 := a29
        signal30 := a30
      }
  | _ =>
      none

theorem ofList_toList (s : PublicSignals) :
    ofList (toList s) (toList_length s) = some s := by
  simp [ofList, toList]

end AegisProof.Core