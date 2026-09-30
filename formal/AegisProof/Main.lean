import AegisProof.Core.PublicSignals
import AegisProof.Core.Commitment
import AegisProof.Core.Nullifier
import AegisProof.Core.ProofSemantics

import AegisProof.Invariants.SignalLayout
import AegisProof.Invariants.CommitmentBinding
import AegisProof.Invariants.NullifierBinding
import AegisProof.Invariants.CanonicalProof
import AegisProof.Invariants.FrozenCore

import AegisProof.Security.Soundness
import AegisProof.Security.Completeness
import AegisProof.Security.NonMalleability
import AegisProof.Security.DomainSeparation

import AegisProof.Provenance.ArtifactHash
import AegisProof.Provenance.Manifest
import AegisProof.Provenance.SignatureBinding

import AegisProof.TEE.Boundary

import AegisProof.Tests.SignalTests
import AegisProof.Tests.InvariantTests
import AegisProof.Tests.Regression

namespace AegisProof

/--
Top-level formal assurance sentinel.

The project is formally wired when this theorem compiles.
-/
theorem formal_assurance_layer_compiles :
    Core.publicSignalCount = 30 := by
  rfl

end AegisProof