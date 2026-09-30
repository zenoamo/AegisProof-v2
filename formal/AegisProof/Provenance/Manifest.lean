import AegisProof.Provenance.ArtifactHash

namespace AegisProof.Provenance

structure Manifest where
  artifacts : List Artifact

/-- An artifact is present in the provenance manifest. -/
def ArtifactRegistered
    (manifest : Manifest)
    (artifact : Artifact) : Prop :=
  artifact ∈ manifest.artifacts

/-- Register an artifact in a manifest. -/
def registerArtifact
    (manifest : Manifest)
    (artifact : Artifact) : Manifest :=
  {
    manifest with
    artifacts := artifact :: manifest.artifacts
  }

/-- Registration establishes manifest membership. -/
theorem registerArtifact_valid
    (manifest : Manifest)
    (artifact : Artifact) :
    ArtifactRegistered
      (registerArtifact manifest artifact)
      artifact := by
  simp [ArtifactRegistered, registerArtifact]

/--
Every artifact already in a manifest remains registered after
adding another artifact.
-/
theorem registration_preserves_existing
    (manifest : Manifest)
    (existing newArtifact : Artifact)
    (h : ArtifactRegistered manifest existing) :
    ArtifactRegistered
      (registerArtifact manifest newArtifact)
      existing := by
  exact List.mem_cons_of_mem newArtifact h

end AegisProof.Provenance