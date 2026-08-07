# AegisProof v2 — Full Architecture Diagram

**Version:** v2 (current final state as of Phase 8.13)  
**Audience:** Engineers, security auditors, architecture reviewers  
**Format:** Mermaid (SVG-exportable)  
**Scope:** ZK core, operational extensions, PQC layers, CI security, TEE boundary, future migration  

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 **Frozen Boundary** | Immutable without Architecture Review — circuits, zkey, VK, verifier, protocol, SDK, `proveCanonical()` |
| 🔵 **Extension Layer** | Additive, rollback-safe — resolver, provenance, PQC, hybrid auth, CI tooling |
| 🟡 **Trust Boundary** | Explicit security isolation line |
| ➡️ **Data Flow** | Artifact / proof / signal movement |
| 🔒 **Trust Flow** | Verification / authorization / attestation |

```mermaid
flowchart LR
  subgraph LEGEND["Legend"]
    F["🔴 Frozen Core"]
    E["🔵 Extension Layer"]
    T["🟡 Trust Boundary"]
  end
  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px,color:#330000
  classDef extension fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#001a33
  classDef trust fill:#fff8e6,stroke:#cc9900,stroke-width:2px,color:#332600
  class F frozen
  class E extension
  class T trust
```

---

## 1. AegisProof v2 — Full System Architecture

```mermaid
flowchart TB
  subgraph APP["Application Layer 🔵"]
    USERS["Users / dApps / Integrators"]
    APPS["Application Logic"]
  end

  subgraph SDK["SDK / API Interface 🔵"]
    SDKPKG["packages/sdk<br/>@aegisproof/sdk"]
    API["Proof load · calldata · typed errors"]
  end

  subgraph PROTO["AegisProof Protocol Layer 🔴 FROZEN"]
    SHIELD["AegisShieldV2.sol<br/>session · replay · timestamp policy"]
    SPEC["specs/aegis-protocol.v2.json<br/>30 publicSignals layout"]
  end

  subgraph FROZEN_CORE["🔴 FROZEN SECURITY CORE BOUNDARY"]
    direction TB
    CIRCUIT["circuits/ (source lost)<br/>compiled artifacts canonical"]
    R1CS["R1CS aegis_commit_core_v2.r1cs"]
    WITNESS["Witness Generation<br/>secretKey · deviceId"]
    ZKEY["production.zkey<br/>Phase 4 ceremony · pinned hash"]
    PROVER["Prover Pipeline<br/>proveCanonical()"]
    PS["proof + publicSignals(30)"]
    VERIFIER["Groth16VerifierV2Production.sol"]
  end

  subgraph CHAIN["Blockchain"]
    BC["On-chain verify + Shield accept"]
  end

  subgraph OPS["Operational Extension Layer 🔵"]
    RESOLVER["resolveArtifacts()<br/>artifact resolver · fail-closed"]
    MANIFEST["artifacts/provenance/manifest.json"]
    SHA["SHA-256 Integrity"]
    MLDSA_PROV["ML-DSA-87 Provenance Signature"]
    PKREG["PQC Public Key Registry<br/>public-keys/*.json"]
  end

  subgraph AUTH["Authentication Layer 🔵 Research"]
    OP["Operator / Admin"]
    HYBRID["Hybrid Auth Envelope<br/>AEGIS_AUTH_ENVELOPE_V1"]
    ECDSA["ECDSA secp256k1"]
    MLDSA_AUTH["ML-DSA-87"]
  end

  subgraph CI["CI/CD Security Layer 🔵"]
    PR["PR / Push"]
    T19["T1–T9 Regression"]
    ARTCHK["Artifact Verification"]
    PROV["Provenance SHA-256"]
    PQCCHK["PQC Verify optional/strict"]
    SCHED["Scheduled CI<br/>Benchmark · Drift · Strict PQC"]
  end

  subgraph TEE["TEE Boundary 🟡 ADR-001 Isolated"]
    TEEP["tee/ Attestation Pipeline<br/>Provider → Verifier → ClaimsGate"]
    CLAIMS["Claims only · no protocol merge"]
  end

  subgraph FUTURE["Future Migration Boundary ⬜ Phase 9+"]
    PQZK["PQ-ZK research"]
    STARK["STARK evaluation"]
    NEWV["New verifier / circuit<br/>(parallel version)"]
    NOTE["Groth16 v2 remains unchanged"]
  end

  USERS --> APPS
  APPS --> SDKPKG
  SDKPKG --> API
  API --> SHIELD
  SHIELD --> VERIFIER

  CIRCUIT --> R1CS
  R1CS --> WITNESS
  WITNESS --> PROVER
  ZKEY --> PROVER
  PROVER --> PS
  PS --> VERIFIER
  VERIFIER --> BC
  SHIELD --> BC

  RESOLVER --> MANIFEST
  MANIFEST --> SHA
  MANIFEST --> MLDSA_PROV
  MLDSA_PROV --> PKREG

  OP --> HYBRID
  HYBRID --> ECDSA
  HYBRID --> MLDSA_AUTH

  PR --> T19 --> ARTCHK --> PROV --> PQCCHK
  SCHED --> PQCCHK

  TEEP --> CLAIMS

  FROZEN_CORE -.->|"no intrusion"| OPS
  FROZEN_CORE -.->|"no intrusion"| AUTH
  FROZEN_CORE -.->|"no intrusion"| TEE
  FROZEN_CORE -.->|"parallel only"| FUTURE

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px,color:#330000
  classDef extension fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#001a33
  classDef trust fill:#fff8e6,stroke:#cc9900,stroke-width:3px,color:#332600
  classDef future fill:#f0f0f0,stroke:#666666,stroke-width:1px,stroke-dasharray:5 5,color:#333333

  class CIRCUIT,R1CS,WITNESS,ZKEY,PROVER,PS,VERIFIER,SHIELD,SPEC frozen
  class SDKPKG,API,RESOLVER,MANIFEST,SHA,MLDSA_PROV,PKREG,HYBRID,ECDSA,MLDSA_AUTH,PR,T19,ARTCHK,PROV,PQCCHK,SCHED,USERS,APPS extension
  class TEEP,CLAIMS trust
  class PQZK,STARK,NEWV,NOTE future
```

### Frozen vs Mutable Summary

| 🔴 Frozen (Architecture Review required) | 🔵 Mutable / Extension |
|----------------------------------------|------------------------|
| `circuits/` compiled artifacts | Prover backend (snarkjs / rapidsnark) |
| R1CS | `resolveArtifacts()` profiles |
| Trusted setup / `production.zkey` | Provenance manifest |
| Verification key (ceremony hash pinned) | ML-DSA-87 provenance layer |
| `publicSignals` layout (30) | Hybrid auth envelope (research) |
| `Groth16VerifierV2Production.sol` | CI tooling & benchmarks |
| `protocol/contracts/` | Public key registry (public keys only) |
| `packages/sdk/` API semantics | TEE research adapter |
| `proveCanonical()` return semantics | — |
| `tee/` ADR-001 boundary | — |

---

## 2. ZK Proof Flow Diagram

End-to-end Groth16 proof generation and verification — **entire path inside 🔴 Frozen Core**.

```mermaid
flowchart LR
  subgraph INPUTS["Private Inputs"]
    SK["secretKey"]
    DID["deviceId"]
  end

  subgraph PUBLIC["Public Inputs / Metadata"]
    META["prediction · confidence · chainId<br/>sessionId · timestamp · …"]
  end

  subgraph COMPILE["🔴 Canonical Artifacts"]
    WASM["aegis_commit_core_v2.wasm"]
    R1CS["aegis_commit_core_v2.r1cs"]
    ZKEY["production.zkey<br/>ce5a3d30…6571"]
    VKEY["production-vkey.json<br/>d012bd29…d2ec"]
  end

  subgraph PROVE["Prover Pipeline 🔴 proveCanonical()"]
    WTNS["Witness builder"]
    PROV["SnarkjsProver / RapidsnarkProver"]
    OUT["proof + publicSignals(30)"]
  end

  subgraph VERIFY_OFF["Off-chain Verify"]
    SNARKJS["snarkjs groth16.verify"]
  end

  subgraph VERIFY_ON["🔴 On-chain Verify"]
    G16["Groth16VerifierV2Production.sol"]
    SHIELD["AegisShieldV2.sol<br/>policy gate"]
  end

  SK --> WTNS
  DID --> WTNS
  META --> WTNS
  WASM --> WTNS
  R1CS --> WTNS
  WTNS --> PROV
  ZKEY --> PROV
  PROV --> OUT
  OUT --> SNARKJS
  VKEY --> SNARKJS
  OUT --> G16
  VKEY --> G16
  G16 --> SHIELD

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px
  class WASM,R1CS,ZKEY,VKEY,PROV,OUT,G16,SHIELD frozen
```

**Invariant checks (T1–T9):** proof verifies off-chain · on-chain · publicSignals 30/30 · zkey/VK hashes pinned · tampered proof/commitment rejected.

---

## 3. Artifact Trust Chain Diagram

Supply-chain integrity: classical hash binding + PQC authenticity — **does not alter ZK artifacts**.

```mermaid
flowchart TB
  subgraph SOURCES["Artifact Sources"]
    CA["crypto-artifacts/ mirror"]
    AP["artifacts/phase2+phase4"]
  end

  subgraph RESOLVE["🔵 resolveArtifacts() — fail-closed"]
    PROFILE["profiles: prover · phase2 · production"]
    PINS["assertProductionHashes()"]
  end

  subgraph ARTIFACTS["Pinned Artifacts"]
    ZK["production.zkey"]
    VKF["production-vkey.json"]
    WSM["aegis_commit_core_v2.wasm"]
    RCS["aegis_commit_core_v2.r1cs"]
  end

  subgraph MANIFEST["artifacts/provenance/manifest.json"]
    ENTRY["per-entry: sha256 · classicalHash"]
    ENV["pqcSignatureEnvelope<br/>ML-DSA-87 · publicKeyId"]
  end

  subgraph VERIFY_CHAIN["Verification Order"]
    V1["1. Manifest integrity"]
    V2["2. SHA-256 live hash vs manifest"]
    V3["3. ML-DSA-87 signature verify"]
  end

  subgraph TRUST["Trust Anchors"]
    PIN["Pinned constants<br/>zkey · VK ceremony hash"]
    REG["Public Key Registry<br/>aegis-ci-mldsa87-v1.json"]
  end

  CA --> RESOLVE
  AP --> RESOLVE
  RESOLVE --> ARTIFACTS
  RESOLVE --> MANIFEST
  ARTIFACTS --> ENTRY
  ENTRY --> V1 --> V2 --> V3
  PIN --> V2
  REG --> V3
  ENV --> V3

  FROZEN_NOTE["🔴 ZK artifacts byte-identical<br/>provenance is metadata-only"]

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:2px
  classDef extension fill:#e6f3ff,stroke:#0066cc,stroke-width:2px
  classDef verify fill:#e6ffe6,stroke:#009900,stroke-width:2px

  class ZK,VKF,WSM,RCS,FROZEN_NOTE frozen
  class RESOLVE,PROFILE,PINS,MANIFEST,ENTRY,ENV,REG extension
  class V1,V2,V3 verify
```

---

## 4. PQC Integration Boundary Diagram

Shows **where PQC applies** vs **where Groth16 remains classical** — critical for audit.

```mermaid
flowchart TB
  subgraph ATTACK["Attacker Model"]
    A1["Supply-chain tampering"]
    A2["Manifest spoofing"]
    A3["Unauthorized deployment"]
    A4["Quantum break (BN254/Groth16)"]
  end

  subgraph DEFENSE["Defense Layers 🔵 Additive Only"]
    D1["SHA-256 integrity<br/>artifact-provenance.mjs"]
    D2["ML-DSA-87 provenance<br/>pqc-signature.mjs"]
    D3["Hybrid Auth Envelope<br/>ECDSA + ML-DSA-87"]
    D4["CI strict mode --pqc"]
  end

  subgraph FROZEN["🔴 FROZEN — NO PQC REPLACEMENT"]
    GROTH16["Groth16 proof system"]
    BN254["BN254 curve"]
    VERIFIER["Groth16VerifierV2Production"]
    PROVE["proveCanonical()"]
  end

  subgraph BOUNDARY["🟡 Trust Boundary"]
    LINE["PQC never enters proof/verify path"]
  end

  A1 --> D1
  A2 --> D2
  A3 --> D3
  A4 -.->|"monitor Phase 9+"| FUTURE2["Future PQ-ZK research"]

  D1 --> D2
  D2 --> D4
  D3 -.->|"future deploy gate"| DEPLOY["scripts/deploy.ts"]

  D1 -.-> LINE
  D2 -.-> LINE
  D3 -.-> LINE
  LINE -.-> GROTH16
  GROTH16 --> BN254 --> VERIFIER
  PROVE --> GROTH16

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px
  classDef extension fill:#e6f3ff,stroke:#0066cc,stroke-width:2px
  classDef attack fill:#fff0f0,stroke:#990000,stroke-width:1px
  classDef boundary fill:#fff8e6,stroke:#cc9900,stroke-width:4px

  class GROTH16,BN254,VERIFIER,PROVE frozen
  class D1,D2,D3,D4,DEPLOY extension
  class A1,A2,A3,A4 attack
  class LINE,BOUNDARY boundary
```

### Domain Separation (signing contexts)

| Layer | Domain String | Module |
|-------|---------------|--------|
| Artifact provenance | `AEGIS_ARTIFACT_PROVENANCE_V1` | `pqc-signature.mjs` |
| Deployment auth payload | `AEGIS_DEPLOYMENT_AUTH_V1` | `hybrid-auth-envelope.mjs` |
| Auth envelope wrapper | `AEGIS_AUTH_ENVELOPE_V1` | `hybrid-auth-envelope.mjs` |

---

## 5. Security Layer Stack Diagram

Defense-in-depth from user to chain — **audit view in ~5 minutes**.

```mermaid
flowchart BT
  subgraph L7["Layer 7 — Application"]
    L7A["dApp · integrator · operator UI"]
  end

  subgraph L6["Layer 6 — SDK 🔵"]
    L6A["packages/sdk — calldata · proof load"]
  end

  subgraph L5["Layer 5 — Protocol Policy 🔴"]
    L5A["AegisShieldV2 — session · replay · timestamp"]
  end

  subgraph L4["Layer 4 — ZK Verification 🔴"]
    L4A["Groth16VerifierV2Production"]
    L4B["publicSignals(30) layout"]
  end

  subgraph L3["Layer 3 — ZK Proving 🔴"]
    L3A["proveCanonical() · production.zkey · R1CS"]
  end

  subgraph L2E["Layer 2E — Operational Security 🔵"]
    L2EA["Artifact resolver + provenance"]
    L2EB["ML-DSA-87 signatures"]
    L2EC["Hybrid auth envelope"]
    L2ED["CI T1–T9 · drift · strict PQC"]
  end

  subgraph L2T["Layer 2T — TEE Research 🟡"]
    L2TA["tee/ ADR-001 · ClaimsGate · offline fixture"]
  end

  subgraph L1["Layer 1 — Infrastructure"]
    L1A["Blockchain · Hardhat · CI runners"]
  end

  subgraph L0["Layer 0 — Future 🟡 Phase 9+"]
    L0A["Parallel PQ-ZK protocol version"]
  end

  L7A --> L6A --> L5A --> L4A
  L4A --> L3A --> L1A
  L2EA -.->|"wraps supply chain"| L3A
  L2EB -.->|"authenticates metadata"| L2EA
  L2EC -.->|"authorizes deployment"| L7A
  L2ED -.->|"regression gate"| L3A
  L2TA -.->|"isolated claims"| L7A
  L0A -.->|"does not replace"| L4A

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px
  classDef extension fill:#e6f3ff,stroke:#0066cc,stroke-width:2px
  classDef tee fill:#fff8e6,stroke:#cc9900,stroke-width:2px
  classDef future fill:#f0f0f0,stroke:#666666,stroke-dasharray:4 4

  class L5A,L4A,L4B,L3A frozen
  class L6A,L2EA,L2EB,L2EC,L2ED extension
  class L2TA tee
  class L0A future
```

---

## 6. CI/CD Security Flow

```mermaid
flowchart TB
  subgraph PR_PATH["PR / Push Path"]
    P1["checkout + npm ci"]
    P2["T1–T9 test:prover-compat"]
    P3["verify:provenance --live<br/>SHA-256 required · PQC WARN"]
    P4["test:artifact-provenance"]
    P5["test:pqc-signature"]
    P6["test:hybrid-auth research"]
    P1 --> P2 --> P3 --> P4 --> P5 --> P6
  end

  subgraph SCHED_PATH["Schedule / Manual Path"]
    S1["prover-benchmark M1–M5"]
    S2["provenance-pqc-hardening<br/>--live --pqc strict"]
    S3["bench:provenance"]
    S4["hybrid-auth-research<br/>bench:hybrid-auth"]
    S1 --> S2 --> S3
    S1 --> S4
  end

  subgraph GATES["Failure Boundaries"]
    G_FAIL["FAIL: hash mismatch · T regression"]
    G_WARN["WARN: unsigned PQC · missing key"]
    G_STRICT["FAIL: --pqc unsigned/invalid sig"]
  end

  P3 --> G_WARN
  P2 --> G_FAIL
  S2 --> G_STRICT

  classDef fail fill:#ffe6e6,stroke:#cc0000,stroke-width:2px
  classDef warn fill:#fff8e6,stroke:#cc9900,stroke-width:2px
  class G_FAIL,G_STRICT fail
  class G_WARN warn
```

---

## 7. TEE Boundary (ADR-001)

```mermaid
flowchart LR
  subgraph PROTO_V2["🔴 Protocol v2 — FROZEN"]
    PV2["contracts · SDK · Groth16"]
  end

  subgraph TEE_LAYER["🟡 tee/ — Isolated Layer B"]
    PIPE["AttestationPipeline<br/>compose-only orchestrator"]
    GATE["ClaimsGate<br/>verificationLevel ≥ OFFLINE_FIXTURE"]
    MOCK["Mock normalizer ⊥ Real normalizer<br/>SB-01 frozen"]
  end

  subgraph OUTPUT["Output Contract"]
    CLAIMS["Claims only — no direct protocol injection"]
  end

  PIPE --> GATE --> CLAIMS
  CLAIMS -.->|"no merge in 8.x"| PROTO_V2

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px
  classDef tee fill:#fff8e6,stroke:#cc9900,stroke-width:3px

  class PV2 frozen
  class PIPE,GATE,MOCK,CLAIMS tee
```

---

## 8. Future Migration Boundary (Phase 9+)

```mermaid
flowchart TB
  subgraph CURRENT["🔴 AegisProof v2 — Permanent Baseline"]
    V2["Groth16 · BN254 · 30 publicSignals<br/>production.zkey · Groth16VerifierV2Production"]
  end

  subgraph RESEARCH["⬜ Phase 9+ Research Track"]
    PQ["PQ-ZK candidate evaluation"]
    ST["STARK / hash-based alternatives"]
    NP["New circuit + verifier pair"]
    PAR["Parallel protocol version"]
  end

  V2 -->|"remains valid"| PROD["Production proofs unchanged"]
  RESEARCH -.->|"additive fork"| PAR
  PAR -.->|"no in-place replacement"| V2

  classDef frozen fill:#ffe6e6,stroke:#cc0000,stroke-width:3px
  classDef future fill:#f0f0f0,stroke:#666666,stroke-dasharray:5 5

  class V2,PROD frozen
  class PQ,ST,NP,PAR future
```

---

## Quick Audit Checklist (5-Minute Review)

1. **Is Groth16 touched by PQC?** No — separate domains, separate modules, dashed boundary in §4.
2. **What fails closed?** Artifact resolver, SHA-256 mismatch, `--pqc` strict mode, T1–T9 regression.
3. **What is WARN-only?** Unsigned PQC on PR path; hybrid auth research mode.
4. **What is frozen?** Red-boxed nodes in §1 table — any change requires Architecture Review.
5. **TEE vs Protocol?** ADR-001 isolation — claims only, no contract merge.
6. **Future PQ?** Parallel version only — v2 Groth16 baseline preserved.
7. **GitHub vs Vault?** GitHub = code + public metadata; secrets in external storage — see [GitHub Security Boundary](./github-security-boundary.md).

---

## Trust Model Layers (Task 8 — GitHub Governance)

| Layer | Components | GitHub role |
|-------|------------|-------------|
| **Frozen Core** | circuits, R1CS, zkey hash, VK hash, Groth16Verifier, publicSignals(30), proveCanonical() | Hash pins only — binaries target external storage |
| **Operational Layer** | scripts, CI, benchmarks | Full repository management |
| **Trust Extension** | provenance, ML-DSA signatures, public key registry | Public keys + manifest; private keys in vault |
| **Secret Layer** | private keys, HSM, deployment credentials | **Never commit** — enforced by `check:sensitive-files` |

## SVG Export

Render any diagram to SVG via Mermaid CLI:

```bash
npx @mermaid-js/mermaid-cli -i docs/architecture/aegisproof-v2-full-architecture.md -o docs/architecture/diagrams/
```

Or paste individual fenced `mermaid` blocks into [Mermaid Live Editor](https://mermaid.live) for export.

---

## References

- [Architecture Overview](./overview.md)
- [GitHub Repository Boundary](./github-repository-boundary.md) — inventory A/B/C/D classification
- [GitHub Security Boundary](./github-security-boundary.md) — trust model, key lifecycle, CI gate
- [ADR-001 Architecture Hardening Freeze](./adr/001-architecture-hardening-freeze.md)
- [Prover Regression Contract](../perf/prover-regression-contract.md)
- [Phase 8.13 PQC CI Policy](../research/phase8.13-pqc-ci-policy.md)
- [Phase 8.13 Hybrid Auth Envelope](../research/phase8.13-hybrid-auth-envelope.md)
