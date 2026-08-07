# Phase 8.13 Architecture Summary

**Status:** Complete (Tasks 1–9 + Final)  
**Date:** 2026-08-07  

---

## Overview

Phase 8.13 adds quantum-readiness **outer layers** to AegisProof v2 without modifying the Groth16 ZK core. PQC applies to artifact provenance and operator authorization research only.

```
┌─────────────────────────────────────────────────────────┐
│  Phase 8.13 Additive Layers (scripts/ only)             │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Provenance      │  │ Hybrid Auth Envelope       │  │
│  │ SHA-256 +       │  │ ECDSA + ML-DSA-87          │  │
│  │ ML-DSA-87       │  │ (research)                 │  │
│  └─────────────────┘  └──────────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Public Key      │  │ GitHub Security Gate     │  │
│  │ Registry        │  │ sensitive-files policy   │  │
│  └─────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↕ no intrusion
┌─────────────────────────────────────────────────────────┐
│  FROZEN ZK CORE (Phase 8.10–8.11)                       │
│  circuits · zkey · VK · Groth16Verifier · proveCanonical │
│  publicSignals(30) · protocol/ · packages/sdk/ · tee/   │
└─────────────────────────────────────────────────────────┘
```

---

## Task Index

| Task | Title | Key deliverables |
|------|-------|------------------|
| 1–3 | Provenance boundary | `artifact-provenance.mjs`, manifest schema, CI hash verify |
| 4 | ML-DSA-87 activation | `pqc-signature.mjs`, T-PQC-01..05 |
| 5 | CI hardening | public key registry, T-PQC-06..10, strict `--pqc` tier |
| 6 | Hybrid auth research | `hybrid-auth-envelope.mjs`, T-AUTH-01..08 |
| 7 | Repository security gate | `sensitive-files-policy.mjs`, T-SEC-01..10 |
| 8 | Unified regression | `run-phase813-regression.mjs`, T-813 gate |
| 9 | Documentation | This summary + completion reports |
| Final | Phase closure | `phase8.13-final-completion-report.md` |

---

## Verification Domains

| Domain | String | Module |
|--------|--------|--------|
| Artifact provenance | `AEGIS_ARTIFACT_PROVENANCE_V1` | `pqc-signature.mjs` |
| Deployment auth payload | `AEGIS_DEPLOYMENT_AUTH_V1` | `hybrid-auth-envelope.mjs` |
| Auth envelope wrapper | `AEGIS_AUTH_ENVELOPE_V1` | `hybrid-auth-envelope.mjs` |

PQC never enters Groth16 proof or verify path.

---

## CI Jobs (Phase 8.13)

| Job | Trigger | Purpose |
|-----|---------|---------|
| `security-boundary-check` | PR / push | T-SEC + T-813 + sensitive scan + provenance + T1–T9 |
| `prover-compatibility` | PR / push | Extended PQC/hybrid tests |
| `provenance-pqc-hardening` | schedule / manual | Strict `--pqc` |
| `phase813-regression` | schedule / manual | Full `test:phase813` |
| `hybrid-auth-research` | PR / optional | T-AUTH |

---

## npm Scripts

| Script | Purpose |
|--------|---------|
| `generate:provenance` | Build manifest |
| `verify:provenance -- --live` | Hash verify (PR required) |
| `verify:provenance -- --pqc` | Strict PQC (schedule) |
| `test:pqc-signature` | T-PQC unit tests |
| `test:hybrid-auth` | T-AUTH unit tests |
| `test:sensitive-files-boundary` | T-SEC policy tests |
| `test:phase813` | Unified 8.13 regression |
| `check:sensitive-files` | Live git boundary scan |
| `check:security-boundary` | Sensitive + provenance |

---

## Frozen Confirmation

Unchanged: circuits, R1CS, `production.zkey` hash pin, VK hash pin, `Groth16VerifierV2Production.sol`, `publicSignals(30)`, `proveCanonical()`, `protocol/`, `packages/sdk/`, `tee/`, T1–T9 invariants.

---

## References

- [PQC Wrapper](./phase8.13-pqc-wrapper.md)
- [PQC CI Policy](./phase8.13-pqc-ci-policy.md)
- [Hybrid Auth Envelope](./phase8.13-hybrid-auth-envelope.md)
- [Repository Security Gate](./phase8.13-repository-security-gate.md)
- [Unified Regression Gate](./phase8.13-unified-regression-gate.md)
- [Full Architecture Diagrams](../architecture/aegisproof-v2-full-architecture.md)
