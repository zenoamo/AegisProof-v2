import AegisProof.Invariants.SignalLayout
import AegisProof.Invariants.CommitmentBinding
import AegisProof.Invariants.NullifierBinding
import AegisProof.Invariants.CanonicalProof
import AegisProof.Invariants.FrozenCore

namespace AegisProof.Tests

open AegisProof.Core
open AegisProof.Invariants

def testWitness : Witness :=
  {
    secret := 42
  }

def testContext : NullifierContext :=
  {
    domain := 7
  }

def baseSignals : PublicSignals :=
  {
    signal01 := 0
    signal02 := 0
    signal03 := 3
    signal04 := 4
    signal05 := 5
    signal06 := 6
    signal07 := 7
    signal08 := 8
    signal09 := 9
    signal10 := 10
    signal11 := 11
    signal12 := 12
    signal13 := 13
    signal14 := 14
    signal15 := 15
    signal16 := 16
    signal17 := 17
    signal18 := 18
    signal19 := 19
    signal20 := 20
    signal21 := 21
    signal22 := 22
    signal23 := 23
    signal24 := 24
    signal25 := 25
    signal26 := 26
    signal27 := 27
    signal28 := 28
    signal29 := 29
    signal30 := 30
  }

example :
    SignalLayoutValid := by
  exact signal_layout_is_valid

example :
    CommitmentBound
      testWitness
      (bindCommitment testWitness baseSignals) := by
  exact bindCommitment_valid testWitness baseSignals

example :
    NullifierBound
      testWitness
      testContext
      (bindNullifier testWitness testContext baseSignals) := by
  exact bindNullifier_valid testWitness testContext baseSignals

example :
    FrozenCoreValid canonicalFrozenCore := by
  exact canonicalFrozenCore_valid

end AegisProof.Tests