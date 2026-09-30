import AegisProof.Provenance.Manifest

namespace AegisProof.Provenance

/--
Abstract signature.

This intentionally does not implement ML-DSA-87.
It represents the relationship between a manifest and an external
signature.
-/
def Signature :=
  String

structure SignedManifest where
  manifest : Manifest
  signature : Signature

/--
A signed manifest is considered signature-bound when its signature
is non-empty.
-/
def SignatureBound
    (signed : SignedManifest) : Prop :=
  signed.signature ≠ ""

/-- Construct a signed manifest. -/
def signManifest
    (manifest : Manifest)
    (signature : Signature)
    (h : signature ≠ "") :
    SignedManifest :=
  {
    manifest := manifest
    signature := signature
  }

/-- Signing establishes the signature-binding invariant. -/
theorem signManifest_valid
    (manifest : Manifest)
    (signature : Signature)
    (h : signature ≠ "") :
    SignatureBound (signManifest manifest signature h) := by
  exact h

/--
Signing does not modify the underlying manifest.
-/
theorem signManifest_preserves_manifest
    (manifest : Manifest)
    (signature : Signature)
    (h : signature ≠ "") :
    (signManifest manifest signature h).manifest = manifest := by
  rfl

end AegisProof.Provenance