import AegisProof.Tests.SignalTests
import AegisProof.Tests.InvariantTests
import AegisProof.Security.Soundness
import AegisProof.Security.Completeness
import AegisProof.Security.NonMalleability
import AegisProof.Security.DomainSeparation
import AegisProof.Provenance.Manifest
import AegisProof.Provenance.SignatureBinding
import AegisProof.TEE.Boundary

namespace AegisProof.Tests

open AegisProof.Core
open AegisProof.Security
open AegisProof.Provenance
open AegisProof.TEE

/--
Formal regression sentinel.

If any imported theorem stops compiling, the formal regression layer
fails to build.
-/
theorem regression_signal_count :
    publicSignalCount = 30 := by
  rfl

theorem regression_soundness :
    SoundnessContract := by
  exact soundness_contract

theorem regression_completeness :
    CompletenessContract := by
  exact completeness_contract

theorem regression_domain_separation
    (w : Witness)
    (ctx₁ ctx₂ : NullifierContext)
    (hDomain : ctx₁.domain ≠ ctx₂.domain)
    (hSeparated : DomainSeparated w ctx₁ ctx₂) :
    nullifierOf w ctx₁ ≠ nullifierOf w ctx₂ := by
  exact domain_separation w ctx₁ ctx₂ hDomain hSeparated

theorem regression_manifest_registration
    (manifest : Manifest)
    (artifact : Artifact) :
    ArtifactRegistered
      (registerArtifact manifest artifact)
      artifact := by
  exact registerArtifact_valid manifest artifact

theorem regression_tee_boundary
    (gate : ClaimsGate)
    (claims : Claims)
    (h : gate.accepted claims = true) :
    passThrough gate claims = some claims := by
  exact passThrough_preserves_claims gate claims h

end AegisProof.Tests