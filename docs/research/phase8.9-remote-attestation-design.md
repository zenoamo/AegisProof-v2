# Phase 8.9A — Remote Attestation Architecture Design

> **Design Only** · **PoC Scope** · **Not Production Implementation**

**Phase**: 8.9A  
**Status**: Architecture Design Only (no code, no network, no verifier service)  
**Prerequisite**: Phase 8.8b Experimental Acquisition Skeleton complete

---

## 1. Purpose

Phase 8.9A defines the **Remote Attestation architecture boundary** for the AegisProof TEE Adapter Layer. It documents evidence lifecycle, trust domains, verifier lifecycle (design only), transport boundary, and production migration gates.

This phase **does not implement** any Remote Attestation service, network transport, production verifier, credential management, DCAP/VCEK real verification, or PCCS/KDS connection.

---

## 2. Scope / Non-Scope

### In Scope (Phase 8.9A)

| Item | Description |
|------|-------------|
| Evidence lifecycle | End-to-end stages from acquisition to future transport |
| Trust boundary | Guest, Adapter, Verification, ZK Core domains |
| Verifier lifecycle | Receive → Verify → Policy Decision → Revocation (design only) |
| Transport boundary | Future layer definition; no implementation |
| Production migration gates | Conditions required before production use |
| Future phase separation | 8.9B / 8.9C / 8.10 boundaries |

### Out of Scope (Phase 8.9A)

| Item | Deferred To |
|------|-------------|
| Remote Attestation service | Phase 8.9C (approval required) |
| Network transport (TLS/gRPC/HTTP) | Phase 8.9C (approval required) |
| Production verifier | Phase 8.9C (approval required) |
| Credential / key management | Production (approval required) |
| DCAP / VCEK real verification | Phase 8.9B (stop condition — approval required) |
| PCCS / KDS connection | Phase 8.9B+ (stop condition — approval required) |
| ZK signal / circuit changes | Phase 8.10 (protocol review required) |
| `protocol/`, `circuits/`, `crypto-artifacts/`, `formal/` changes | **Forbidden** |

---

## 3. Existing TEE Pipeline Mapping

Phase 8.9A builds on the implemented pipeline (Phases 8.6–8.8b). **Component responsibilities are frozen**; this document maps them to the remote attestation lifecycle.

```
┌─────────────────────────────────────────────────────────────────┐
│  IMPLEMENTED (PoC) — Do not change responsibilities in 8.9A    │
├─────────────────────────────────────────────────────────────────┤
│  Acquisition    │ TdxGuestReader / SevGuestReader (placeholder) │
│                 │ Experimental*Reader (TEE_ACQUISITION=experimental)│
│  Parser         │ tdx-quote-parser / sev-report-parser            │
│  Provider       │ tdx-provider / sev-snp-provider (factory)       │
│  Normalizer     │ RealEvidenceNormalizer (structure-only)         │
│  Verification   │ tdx-dcap-verifier-stub / sev-vcek-verifier-stub │
│  Claims Mapping │ zk-claims-mapper (protocol non-contact)         │
├─────────────────────────────────────────────────────────────────┤
│  DESIGN ONLY (Phase 8.9A)                                       │
│  Decision Boundary │ Attestation policy gate (not implemented)    │
│  Transport Layer   │ Network delivery (not implemented)           │
│  Remote Verifier   │ Off-guest verification service (not impl.)   │
└─────────────────────────────────────────────────────────────────┘
```

| Lifecycle Stage | Component | Location | Phase | Status |
|-----------------|-----------|----------|-------|--------|
| Acquisition | `AcquisitionFactory`, Guest Readers | `tee/acquisition/` | 8.7–8.8b | PoC |
| Parsing | Quote/Report Parsers | `tee/parsers/` | 8.6 | PoC |
| Provider orchestration | ProviderFactory, Providers | `tee/providers/` | 8.6 | PoC |
| Normalization | RealEvidenceNormalizer | `tee/normalizers/` | 8.6 | structure-only |
| Verification | DCAP/VCEK stubs | `tee/verification/` | 8.8 | structure-only stub |
| Claims Mapping | ZkClaimsMapper | `tee/integration/` | 8.8 | PoC |
| Attestation Decision | — | — | 8.9A design | **Not implemented** |
| Transport / Service | — | — | 8.9C+ | **Not implemented** |

**Mock path (Phase 8.4)** remains isolated: `tee/mock/evidence-normalizer.ts` and Mock Providers are evaluation-only and must not be extended for Real/Remote paths.

---

## 4. Evidence Lifecycle

> **Design Only** · **PoC Scope** · **Not Production Implementation**

### 4.1 Acquisition

- **Input**: TEE Guest environment (Linux `/dev/tdx_guest`, `/dev/sev-guest`, or experimental ioctl path).
- **Output**: Raw TD Quote or SNP Report bytes.
- **Current state**: Placeholder readers return controlled failure on non-LTEE hosts; experimental readers delegate to `DeferredIoctlHook` (controlled failure).
- **Trust**: Hardware Root of Trust originates signature; Adapter does not verify at this stage.

### 4.2 Parsing

- **Input**: Raw quote/report bytes.
- **Output**: Validated structure (version, size, field layout).
- **Current state**: Structure validation only; no signature or TCB check.
- **Boundary**: Vendor-specific logic stays in separate parsers; no cross-vendor coupling.

### 4.3 Normalization

- **Input**: Parsed evidence + provider metadata.
- **Output**: Normalized evidence object (`pocScope: 'structure-only'`).
- **Current state**: `RealEvidenceNormalizer` — no cryptographic verification.
- **Boundary**: Mock normalizer (`tee/mock/evidence-normalizer.ts`) is **not** used on Real path.

### 4.4 Verification Boundary

- **Input**: Normalized evidence.
- **Output**: Verification result (stub: structure-only pass/fail).
- **Current state**: `TdxDcapVerifierStub` / `SevVcekVerifierStub` — **not production verification**.
- **Critical**: Verification stubs **must not** be treated as DCAP/VCEK production gates.
- **Future**: Phase 8.9B offline DCAP/VCEK PoC (stop condition — separate approval).

### 4.5 Claims Mapping

- **Input**: Normalized + stub-verified evidence.
- **Output**: ZK-oriented claims object (research artifact).
- **Current state**: `ZkClaimsMapper` — protocol non-contact; `bindingNonce` placeholder.
- **Boundary**: Output is **not** approved ZK public input; no `protocol/` changes.

### 4.6 Attestation Decision Boundary

- **Input**: Claims + policy context (design).
- **Output**: Allow / Deny / Defer decision (design only).
- **Current state**: **Not implemented**.
- **Responsibility**: Policy engine evaluates TCB level, freshness, binding nonce, and composite ZK+TEE rules (see `verification-policy.md`).
- **Boundary**: Decision runs outside Guest in future Remote Verifier domain.

### 4.7 Future Transport Layer

- **Input**: Attestation package (evidence + claims + metadata).
- **Output**: Delivery to Remote Verifier.
- **Current state**: **Not implemented**.
- **Future options** (design only): mTLS, signed envelope, replay-protected channel.
- **Phase 8.9C**: Verifier PoC may introduce minimal transport (approval required).

---

## 5. Trust Boundary

> **Design Only** · **PoC Scope** · **Not Production Implementation**

### 5.1 Guest Domain

| Aspect | Definition |
|--------|------------|
| Boundary | Inside TEE Guest VM / confidential workload |
| Trust anchor | CPU hardware (Intel TDX / AMD SEV-SNP) |
| Components | Guest readers, raw quote/report generation |
| Untrusted from verifier view | Guest OS, host hypervisor (mitigated by hardware attestation) |
| Current limitation | Acquisition may fail or return placeholder; not production attestation |

### 5.2 Adapter Domain

| Aspect | Definition |
|--------|------------|
| Boundary | AegisProof TEE Adapter Layer (`tee/`) |
| Trust assumption | Trusted software processing signed hardware evidence |
| Components | Parsers, Providers, Normalizer, Verification stubs, Claims Mapper |
| Isolation | Mock path vs Real path strictly separated |
| Current limitation | structure-only / verification-stub — **cannot assert production trust** |

### 5.3 Verification Domain

| Aspect | Definition |
|--------|------------|
| Boundary | Off-guest verifier (future) + offline crypto verification (8.9B) |
| Trust anchor | Intel DCAP collateral / AMD VCEK chain (future) |
| Current state | Stubs only inside Adapter; no Remote Verifier |
| Future | Phase 8.9B: offline verification PoC; Phase 8.9C: Remote Verifier service |

### 5.4 ZK Core Boundary

| Aspect | Definition |
|--------|------------|
| Boundary | Existing AegisProof protocol v2 (`protocol/`) — **change forbidden** |
| Integration point | Claims Mapper output → future ZK input mapper (Phase 8.10) |
| Rule | TEE integration is optional outer layer; ZK-only mode must remain valid |
| Reference | `tee/integration/zk-evidence-integration-design.md` |

### Trust Flow Diagram

```
[ Hardware RoT ]     Guest Domain
       ↓
[ Raw Evidence ]     Guest Domain
       ↓
[ Adapter Layer ]    Adapter Domain  ← current implementation ends here (PoC)
       ↓
[ Verification ]     Verification Domain (stub today; real in 8.9B+)
       ↓
[ Claims ]           Adapter Domain (protocol non-contact)
       ↓
[ Transport ]        Future — separate trust domain
       ↓
[ Remote Verifier ]  Verification Domain (8.9C — not implemented)
       ↓
[ Policy Decision ]  Application / Verifier Domain
       ↓
[ ZK Core ]          ZK Core Boundary (unchanged protocol)
```

---

## 6. Verifier Lifecycle (Design Only)

> **Design Only** · **Not Production Implementation**

No verifier service is implemented in Phase 8.9A. The following lifecycle defines **future responsibilities**.

### 6.1 Receive

- Accept attestation package from Transport Layer.
- Validate envelope integrity (signature, timestamp, nonce binding).
- Reject replayed or stale packages.

### 6.2 Verify

- Re-run or delegate DCAP/VCEK verification (Phase 8.9B+).
- Cross-check measurement against expected TCB / policy.
- Validate `bindingNonce` against ZK public inputs (Phase 8.10+).

### 6.3 Policy Decision

- Evaluate composite rules (TEE + ZK) per `verification-policy.md`.
- Emit Allow / Deny / Defer with audit log.
- **Not implemented** in Phase 8.9A.

### 6.4 Revocation (Future Point)

- TCB revocation list updates (Intel PCS / AMD KDS).
- Certificate / collateral expiry handling.
- Policy version rollover.
- **Deferred** — requires PCCS/KDS (stop condition).

---

## 7. Transport Boundary

> **Design Only** · **PoC Scope** · **Not Production Implementation**

| Aspect | Phase 8.9A Status |
|--------|-------------------|
| TLS / mTLS | **Not implemented** |
| gRPC / HTTP API | **Not implemented** |
| Attestation envelope format | Design reference only |
| Network endpoints | **None** |
| Credential in transit | **No production keys** |

**Rules**:

1. Transport is a **separate trust domain** from Guest and Adapter.
2. Any transport implementation requires Phase 8.9C approval and design review.
3. Replay protection requires nonce + timestamp binding (Claims Mapper placeholder today).
4. Production migration **must not** proceed without transport threat model review.

---

## 8. Production Migration Gates

All gates must pass before Production Remote Attestation. **None are satisfied today.**

| Gate | Description | Status |
|------|-------------|--------|
| G1 | Real Evidence acquisition on Linux TEE hardware | Not met (placeholder / experimental skeleton) |
| G2 | Offline DCAP/VCEK verification PoC (Phase 8.9B) | Not met — **approval required** |
| G3 | Verification stubs replaced or augmented with real crypto verification | Not met |
| G4 | Remote Verifier service PoC (Phase 8.9C) | Not met — **approval required** |
| G5 | Transport layer with threat model sign-off | Not met |
| G6 | ZK signal extension reviewed by protocol team (Phase 8.10) | Not met — **protocol review required** |
| G7 | Security audit / formal review of adapter + verifier boundary | Not met |
| G8 | Mock evaluation path (Stage A) remains unchanged and passing | Met (maintenance) |

**Production use of current PoC components is prohibited.**

---

## 9. Limitations

> **Design Only** · **PoC Scope** · **Not Production Implementation**

| Limitation | Impact |
|------------|--------|
| structure-only normalization | Evidence integrity not cryptographically assured |
| verification stubs | No DCAP/VCEK / TCB validation |
| no transport | Remote Attestation impossible |
| no Remote Verifier | No off-guest policy enforcement |
| claims-mapper-poc | Claims are research artifacts, not ZK inputs |
| Windows CI | Acquisition paths fail by design (controlled failure) |
| experimental acquisition | Native ioctl hook not installed |

---

## 10. Relation to Phase 8.8b

Phase 8.8b added experimental acquisition skeleton (`TEE_ACQUISITION=experimental`) without native dependencies:

- **Default behavior unchanged**: placeholder readers when flag unset.
- **Experimental path**: `DeferredIoctlHook` → controlled failure (expected).
- **Remote Attestation relevance**: Real acquisition is a **prerequisite** for meaningful remote attestation; 8.8b does not enable it alone.
- **8.9A position**: Documents how 8.8b acquisition fits upstream of Verification → Claims → Future Transport.

Phase 8.8c (native ioctl hook) remains deferred and is a **stop condition** — not part of 8.9A.

---

## 11. Future Phase Separation

| Phase | Focus | Stop Condition |
|-------|-------|----------------|
| **8.9A** (this) | Remote Attestation architecture design | No — design only |
| **8.9B** | Offline DCAP/VCEK verification PoC | **Yes — approval required** |
| **8.9C** | Remote Verifier service PoC + minimal transport | **Yes — design review required** |
| **8.8c** | Native ioctl hook | **Yes — native deps approval** |
| **8.10** | ZK Integration (claims → protocol) | **Yes — protocol review required** |

**Rule**: Phases marked with stop conditions require Step 1 + pre-change review before implementation.

---

## 12. Assumptions

- Hardware-signed evidence is the trust root; Adapter software is trusted only after verification gate passes.
- Evidence freshness will use timestamp + `bindingNonce` (Claims Mapper placeholder).
- ZK + TEE composite verification requires cryptographic binding between measurement and ZK public inputs.
- Mock evaluation (Stage A) and Real PoC (Stages B–E) remain independently valid.

---

## 13. References

- [Remote Attestation Flow Design](../../tee/integration/remote-attestation-flow-design.md)
- [Attestation Flow Design](../../tee/integration/attestation-flow-design.md)
- [ZK Evidence Integration Design](../../tee/integration/zk-evidence-integration-design.md)
- [Phase 8.8b Experimental Acquisition](./phase8.8b-ioctl-acquisition-poc.md)
- [Phase 8.8 Verification Plan](./phase8.8-real-tee-verification-plan.md)

---

**Phase 8.9A — Design Only · PoC Scope · Not Production Implementation**
