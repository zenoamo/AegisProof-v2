namespace AegisProof.Provenance

/--
Abstract artifact hash.

The production implementation uses SHA-256.
Lean models the binding contract independently from the concrete
hash implementation.
-/
def ArtifactHash :=
  String

structure Artifact where
  name : String
  hash : ArtifactHash

/-- An artifact is hash-pinned when its hash is non-empty. -/
def HashPinned (artifact : Artifact) : Prop :=
  artifact.hash ≠ ""

/-- Construct a pinned artifact. -/
def pinArtifact
    (name : String)
    (hash : ArtifactHash)
    (h : hash ≠ "") : Artifact :=
  {
    name := name
    hash := hash
  }

/-- A pinned artifact satisfies the hash-pinned invariant. -/
theorem pinArtifact_valid
    (name : String)
    (hash : ArtifactHash)
    (h : hash ≠ "") :
    HashPinned (pinArtifact name hash h) := by
  exact h

end AegisProof.Provenance