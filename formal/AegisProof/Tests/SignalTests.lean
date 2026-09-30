import AegisProof.Core.PublicSignals

namespace AegisProof.Tests

open AegisProof.Core

def testSignals : PublicSignals :=
  {
    signal01 := 1
    signal02 := 2
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
    (toList testSignals).length = 30 := by
  exact toList_length_eq_30 testSignals

example :
    toList testSignals =
      [
        1, 2, 3, 4, 5,
        6, 7, 8, 9, 10,
        11, 12, 13, 14, 15,
        16, 17, 18, 19, 20,
        21, 22, 23, 24, 25,
        26, 27, 28, 29, 30
      ] := by
  rfl

end AegisProof.Tests