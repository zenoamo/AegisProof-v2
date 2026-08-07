# Phase 8.13 Final Completion Report

**Date:** 2026-08-07  
**Status:** Phase 8.13 Complete  

> **Groth16 core is permanently frozen.** No changes were made to circuits, R1CS, `production.zkey`, verification key, verifier contract, `proveCanonical()`, `publicSignals(30)`, `protocol/`, `packages/sdk/`, or `tee/` during Phase 8.13 Tasks 7–Final.

---

## All Tasks

| Task | Title | Status |
|------|-------|--------|
| 1–3 | Provenance boundary + manifest schema | Complete (prior) |
| 4 | ML-DSA-87 signature activation | Complete (prior) |
| 5 | PQC CI hardening + public key registry | Complete (prior) |
| 6 | Hybrid auth envelope research | Complete (prior) |
| 7 | Repository security boundary gate | Complete |
| 8 | Unified regression gate | Complete |
| 9 | Architecture documentation consolidation | Complete |
| Final | Phase closure | Complete |

---

## All Added / Modified Files (Tasks 7–Final)

| File | Task |
|------|------|
| `scripts/lib/sensitive-files-policy.mjs` | 7 |
| `scripts/check-sensitive-files.mjs` | 7 (refactor) |
| `tests/sensitive-files-boundary.test.mjs` | 7 |
| `scripts/run-sensitive-files-boundary.mjs` | 7 |
| `docs/research/phase8.13-repository-security-gate.md` | 7 |
| `docs/research/phase8.13-task7-completion-report.md` | 7 |
| `scripts/run-phase813-regression.mjs` | 8 |
| `tests/phase813-regression-gate.test.mjs` | 8 |
| `scripts/run-phase813-gate.mjs` | 8 |
| `docs/research/phase8.13-unified-regression-gate.md` | 8 |
| `docs/research/phase8.13-task8-completion-report.md` | 8 |
| `docs/research/phase8.13-architecture-summary.md` | 9 |
| `docs/research/phase8.13-task9-completion-report.md` | 9 |
| `docs/research/phase8.13-final-completion-report.md` | Final |
| `docs/research/phase8.13-pqc-wrapper.md` | 9 (status update) |
| `.github/workflows/aegis_repro_ci.yml` | 7–8 |
| `package.json` | 7–8 |

### Phase 8.13 cumulative (Tasks 1–9)

| Category | Key files |
|----------|-----------|
| Provenance | `artifact-provenance.mjs`, `manifest.json`, `verify-provenance-manifest.mjs` |
| PQC | `pqc-signature.mjs`, `public-key-registry.mjs`, `aegis-ci-mldsa87-v1.json` |
| Hybrid auth | `hybrid-auth-envelope.mjs`, `hybrid-auth-benchmark.json` |
| Security gate | `sensitive-files-policy.mjs`, `check-sensitive-files.mjs`, `run-security-boundary-check.mjs` |
| Regression | `run-phase813-regression.mjs`, `run-prover-compat.mjs` |
| Tests | `artifact-provenance`, `pqc-signature`, `hybrid-auth`, `sensitive-files-boundary`, `phase813-gate` |
| Docs | `phase8.13-*.md` (8 research docs + 4 completion reports + this file) |

---

## Architecture Summary

Phase 8.13 established three additive outer layers:

1. **Artifact provenance** — SHA-256 integrity + optional ML-DSA-87 authenticity (`AEGIS_ARTIFACT_PROVENANCE_V1`)
2. **Hybrid auth envelope** — ECDSA + ML-DSA-87 for deployment authorization research (`AEGIS_AUTH_ENVELOPE_V1`)
3. **GitHub security boundary** — sensitive file policy + CI gates

PQC does **not** replace Groth16. Verification order for provenance: manifest integrity → SHA-256 → ML-DSA (optional on PR, strict on schedule).

See [phase8.13-architecture-summary.md](./phase8.13-architecture-summary.md).

---

## Security Boundary Summary

| Layer | GitHub | External |
|-------|--------|----------|
| Source, tests, docs, CI | Yes | — |
| Manifest + public keys | Yes | — |
| Private keys, `.env` | No | Vault / HSM |
| `production.zkey` (target) | Hash only | Secure storage |

Enforcement: `check:sensitive-files`, `security-boundary-check` CI job, T-SEC unit tests.

See [github-security-boundary.md](../architecture/github-security-boundary.md).

---

## Frozen Core Verification

| Invariant | Result |
|-----------|--------|
| `production.zkey` hash (T6) | **PASS** `ce5a3d30…6571` |
| VK hash (T7) | **PASS** `d012bd29…d2ec` |
| `publicSignals` 30/30 (T5) | **PASS** |
| Groth16 off-chain verify (T1) | **PASS** |
| Groth16 on-chain verify (T3) | **PASS** |
| Tamper reject (T8) | **PASS** |
| circuits / protocol / SDK / tee | **No diff** |
| `proveCanonical()` semantics | **Unchanged** |

T1–T9: **21/21 PASS** (T2/T4 SKIP — rapidsnark absent on Windows)

---

## CI Summary

| Job | Trigger | Phase 8.13 coverage |
|-----|---------|---------------------|
| `security-boundary-check` | PR / push | T-SEC + T-813 + sensitive + provenance + T1–T9 |
| `prover-compatibility` | PR / push | PQC + hybrid + provenance tests |
| `provenance-pqc-hardening` | schedule / manual | Strict `--pqc` |
| `phase813-regression` | schedule / manual | Full `test:phase813` |
| `hybrid-auth-research` | PR / optional | T-AUTH |

---

## Benchmark Summary

| Benchmark | Report | Impact on Groth16 |
|-----------|--------|-------------------|
| Provenance verify | `provenance-verify-benchmark.json` | None |
| Hybrid auth | `hybrid-auth-benchmark.json` | None |
| Prover M1–M5 | `baseline.json` | Unchanged (T9 PASS) |

Provenance overhead: ~250–460ms p50 for 6-entry manifest (ML-DSA verify additive).

---

## Remaining Technical Debt

1. `production.zkey` / ptau / wtns git-tracked — allowlist migration debt (8 paths)
2. PQC manifest unsigned on PR tier — WARN until Phase 8.15 strict promotion
3. Hybrid auth not wired to `deploy.ts` — research layer only
4. `crypto-artifacts/` → external secure storage migration pending
5. ML-DSA-65 vs ML-DSA-87 doc inconsistency in Phase 8.14 draft docs

---

## Phase 8.14 Readiness

| Prerequisite | Status |
|--------------|--------|
| Provenance schema v1 stable | Ready |
| ML-DSA-87 adapter operational | Ready |
| Public key registry committed | Ready |
| CI strict tier (`--pqc`) on schedule | Ready |
| SHA-256 path unchanged | Ready |
| Groth16 frozen | Confirmed |

**Phase 8.14 focus:** Production KMS/HSM signing workflow, optional PR `--require-pqc` after review period, manifest signing automation.

---

## Phase 9 Readiness

| Item | Status |
|------|--------|
| Parallel PQ-ZK research track documented | Ready (planning docs) |
| v2 Groth16 baseline preserved | Confirmed |
| TEE ADR-001 isolation | Confirmed |
| Hybrid auth envelope schema | Research complete |

Phase 9 remains a **separate protocol version** research track; v2 Groth16 proofs stay valid.

---

Phase 8.13 Complete
