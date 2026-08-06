# ADR-001: Architecture Hardening Freeze

## Title

Architecture Hardening Freeze

## Status

Accepted

## Date

2026-08-06

## Context

Phase 8.9C-pre (Architecture Hardening, commits `cae6428`–`9d8b7d0`) addressed structural gaps identified during the Architecture Regression Audit prior to Phase 8.9C (Remote Verifier).

### Problems solved

| Gap | Resolution (Phase) |
|-----|-------------------|
| No canonical trust level type | `VerificationLevel` enum in `tee/domain/` (pre.1) |
| Verification result lacked trust metadata | `TeeVerificationResult` with `verificationLevel` field (pre.1) |
| Claims could be generated without verification | `ClaimsGate` requires `isValid` + `OFFLINE_FIXTURE` minimum (pre.3) |
| No horizontal composition layer | `AttestationPipeline` orchestrates Provider → Verifier → Normalizer → ClaimsGate → Policy (pre.4) |
| No regression anchor beyond offline PoC | **Stage G** added to `tee/scripts/evaluate.ts` (pre.4) |
| Environment configuration scattered across factories | `TeeRuntimeConfig` + `loadTeeRuntimeConfig()` (pre.2) |
| Verification trust policy embedded in tests | `tee/policy/verification-policy.ts` — level allow/deny only (pre.2) |
| Pipeline boundaries lacked typed errors | `Result<T>` + `AttestationError` at pipeline/gate boundaries (pre.1, pre.3, pre.4) |

### Hardening scope

- **In scope:** Layer B (TEE Adapter) internal architecture, research/PoC trust boundaries
- **Out of scope:** Protocol v2, circuits, SDK, contracts, online/remote verification

Stage A–G all PASS at HEAD `9d8b7d0`. Security Boundaries SB-01–SB-04 PASS.

---

## Decision

The following are **formal architectural decisions** effective immediately. All future Phase 8.9C+ work MUST comply unless superseded by a new ADR.

### 1. AttestationPipeline is an Orchestrator

`AttestationPipeline` (`tee/pipeline/attestation-pipeline.ts`) is a **compose-only orchestrator**.

- It MUST NOT contain verification logic, claims logic, policy logic, parser logic, or normalizer logic.
- It MUST delegate to existing components via dependency injection (`PipelineDependencies`).
- It MAY catch component throws and convert them to `Result<T>` at the pipeline boundary only.

### 2. Claims MUST pass through ClaimsGate

Claims MUST NOT be generated from normalized evidence alone.

- `ClaimsGate` (`tee/integration/claims-gate.ts`) is the **sole entry point** for claims generation in the hardened path.
- A valid `TeeVerificationResult` with `isValid === true` and `verificationLevel >= OFFLINE_FIXTURE` is required.
- Direct `ZkClaimsMapper.toClaims()` calls remain permitted for **backward compatibility and Stage D regression only**; new integration code MUST use `ClaimsGate`.

### 3. VerificationLevel is the sole Trust Level type

`VerificationLevel` (`tee/domain/verification-level.ts`) is the **only** type representing attestation trust level.

| Level | Meaning (research) |
|-------|-------------------|
| `NONE` | No verification applicable |
| `STRUCTURE_ONLY` | Parser/structure check only (stub) |
| `OFFLINE_FIXTURE` | Offline fixture ECDSA PoC (8.9B) |
| `OFFLINE_VERIFIED` | Reserved — production offline path |
| `HARDWARE_ROOTED` | Reserved — hardware-rooted path |

`pocScope` (`verification-stub` | `offline-verification-poc` | `claims-mapper-poc`) represents **research scope labels only**. It MUST NOT be used as a trust-level substitute or compared across layers for security decisions.

### 4. Mock / Real Normalizers MUST NOT be merged

Security Boundary **SB-01** is frozen:

- `tee/mock/evidence-normalizer.ts` — Mock evidence only; rejects production data
- `tee/normalizers/real-evidence-normalizer.ts` — Real evidence only; rejects MOCK flags
- No unified normalizer, no shared code path that weakens mutual rejection

### 5. Protocol / SDK / contracts dependency is forbidden

Security Boundary **SB-04** is frozen:

- `tee/` MUST NOT import from `protocol/`, `packages/sdk/`, `contracts/`, `crypto-artifacts/`, or `formal/`
- TEE Adapter remains an isolated research layer above Layer A (ZK Protocol)

### 6. Factory public APIs MUST remain backward compatible

`ProviderFactory`, `AcquisitionFactory`, and `VerificationFactory` public method signatures and default behaviors are frozen.

- Internal implementation MAY change (e.g., delegate to `loadTeeRuntimeConfig()`)
- Breaking signature or default-path changes require a new ADR

### 7. Result&lt;T&gt; and AttestationError at pipeline boundaries

Pipeline and gate boundaries (`AttestationPipeline`, `ClaimsGate`) MUST return `Result<T>` — not throw.

- Existing modules (normalizers, `ZkClaimsMapper`) MAY still throw internally
- Pipeline MUST catch and convert to `AttestationError` + `Result`
- Full migration of all modules to `Result` is **deferred** (incremental)

### 8. Stage G is the TEE Layer regression anchor

`tee/scripts/evaluate.ts` Stage G (`pipeline-e2e.test.ts`) is the **mandatory regression gate** for TEE Layer composition changes.

- Stage A–F MUST continue to PASS unchanged
- Any pipeline or integration change MUST pass Stage G before merge
- **CI enforcement:** GitHub Actions job `tee-layer-regression` (`.github/workflows/aegis_repro_ci.yml`) runs `npx tsx tee/scripts/evaluate.ts` on every push and pull request

### 9. PipelineDependencies.config is a reserved extension point

`PipelineDependencies.config` (`TeeRuntimeConfig`) is **retained but not consumed** by `AttestationPipeline` at freeze time.

- Factories continue to read `process.env` via `loadTeeRuntimeConfig()` internally
- Tests inject an explicit config snapshot via DI for future factory wiring
- Phase 8.9C+ (Remote Verifier) MAY use this field to align pipeline deps with runtime mode without changing the DI interface
- Removal is deferred — deleting the field would break test helpers and future factory injection

---

## Security Invariants

### SB-01: Mock ≠ Real

Mock evidence (`MOCK_DATA_ONLY`, `NOT_REAL_ATTESTATION`, `DO_NOT_USE_IN_PRODUCTION`) MUST never be treated as verified real attestation. Separate normalizers enforce mutual rejection. Mock path in pipeline returns `VerificationLevel.NONE` and never generates claims.

### SB-02: VerificationLevel expresses Trust

Trust decisions MUST use `VerificationLevel`, not `pocScope` or `isValid` alone. Offline fixture verification (`OFFLINE_FIXTURE`) is explicitly **not** hardware-rooted trust. `STRUCTURE_ONLY` MUST NOT satisfy claims policy.

### SB-03: Claims ← Verification

Claims generation in the hardened path MUST be preceded by verifier output consumed by `ClaimsGate`. Bypassing verification to reach claims is an architecture violation.

### SB-04: Protocol Isolation

The TEE Adapter MUST remain decoupled from protocol, circuits, and SDK. No cross-layer imports. ZK integration research uses plain claims objects only (`TeeClaims`).

---

## Non Goals

The following are explicitly **not** part of this freeze or the hardening phases:

- Protocol v2 changes
- Circuit / signal / zkey / vkey changes
- Workflow engine or orchestration framework beyond `AttestationPipeline`
- DDD full adoption
- Repository pattern
- Factory consolidation or removal
- Mock/Real normalizer unification
- Online verification (PCCS / KDS live connection)
- Remote Verifier implementation (Phase 8.9C — separate phase)
- Phase 8.10 ZK Schema freeze

---

## Consequences

### Positive

- **Remote Verifier (8.9C)** can be added as a new `TeeVerifier` implementation + factory branch without pipeline rewrite
- **Architecture drift** is detectable via Stage G and ADR compliance review
- **Trust chain** from verification to claims is explicit and testable
- **Configuration** is centralized in `TeeRuntimeConfig` for future runtime policy

### Negative / Trade-offs

- Two claims paths coexist temporarily (direct `ZkClaimsMapper` vs `ClaimsGate`) — new code must use `ClaimsGate`
- Factories still read `process.env` internally; full config injection into factories is deferred
- `PipelineDependencies.config` is injected but not read by the pipeline orchestrator yet (extension point — see Decision 9)
- `Result<T>` migration is partial; some modules still throw

---

## Future Work

| Phase | Scope |
|-------|-------|
| **8.9C** | Remote Verifier — new verifier implementations, PCCS/KDS research path |
| **8.9B+** | Online Verification — live collateral, revocation |
| **8.10** | ZK Schema Freeze — signal schema alignment with `TeeClaims` |

All future work MUST reference this ADR and pass Stage A–G before merge.

---

## References

- HEAD: `9d8b7d0` — `feat(tee): add attestation pipeline and evaluation stage G`
- [TEE Pipeline Architecture](../architecture/tee-pipeline.md)
- [Phase 8.9 Remote Attestation Design](../research/phase8.9-remote-attestation-design.md)
- `tee/README.md` — evaluation stages and directory layout
