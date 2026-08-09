# AegisProof v2 — Implementation Status Matrix

**Status:** SSoT for research expansion (Phase A)  
**Last updated:** 2026-08-09  
**Scope:** Repository state at security remediation closeout (`9562d22`)

> **Legend:** `IMPLEMENTED ≠ LIVE VERIFIED` · `TESTED ≠ PRODUCTION VERIFIED` · `MOCKED ≠ LIVE` · `FIXTURE ≠ HARDWARE ROOTED`

---

## Status Definitions

| Label | Meaning |
|-------|---------|
| **Implemented** | Code or doc artifact exists in the repository |
| **Tested** | Automated regression or security test covers the behavior |
| **Mocked** | Tests use injectable fetch/stub backends; no live service |
| **Research-only** | Explicitly isolated from production Groth16 path (ADR-001 / research docs) |
| **Live Verified** | End-to-end PASS against real production infrastructure (operator evidence) |
| **Production Ready** | Suitable for production deployment with documented residual risk |

---

## Core Matrix

| Component | Implemented | Tested | Mocked | Research-only | Live Verified | Production Ready |
|-----------|:-----------:|:------:|:------:|:-------------:|:-------------:|:----------------:|
| **Groth16 circuit / R1CS** | ✅ | ✅ | — | — | N/A | ✅ (review) |
| **Trusted setup (hash pins)** | ✅ | ✅ | — | — | N/A | ✅ (review) |
| **Verification key** | ✅ | ✅ | — | — | N/A | ✅ (review) |
| **30 public signals layout** | ✅ | ✅ | — | — | N/A | ✅ (frozen) |
| **`proveCanonical()` semantics** | ✅ | ✅ | — | — | N/A | ✅ (frozen) |
| **Off-chain verifier (snarkjs)** | ✅ | ✅ | — | — | N/A | ✅ |
| **Solidity verifier** | ✅ | ✅ | — | — | N/A | ✅ (review) |
| **T1–T9 regression** | ✅ | ✅ | — | — | N/A | ✅ |
| **Provenance (SHA-256)** | ✅ | ✅ | — | — | ✅ (local files) | ✅ |
| **Provenance (KMS release path)** | ✅ | ✅ | ✅ | — | ❌ | ❌ |
| **ML-DSA-87 (metadata signing)** | ✅ | ✅ | — | — | ❌ (KMS path) | ⚠️ partial |
| **Hybrid auth envelope** | ✅ | ✅ | — | ✅ | ❌ | ❌ |
| **Public-key registry** | ✅ | ✅ | — | — | ❌ (prod key missing) | ⚠️ partial |
| **KMS signer abstraction** | ✅ | ✅ | ✅ | — | ❌ | ❌ |
| **Vault Transit backend** | ✅ | ✅ | ✅ | — | ❌ | ❌ |
| **GitHub OIDC → Vault auth** | ✅ | ✅ | ✅ | — | ❌ | ❌ |
| **Cloud HSM backend** | ✅ | ✅ | ✅ | — | ❌ | ❌ |
| **Security remediation (9562d22)** | ✅ | ✅ | — | — | N/A | ✅ |
| **Penetration PT-01–PT-10** | ✅ | ✅ | — | — | N/A | ✅ |
| **Supply chain (elliptic prod tree)** | ✅ | ✅ | — | — | N/A | ✅ |
| **TDX adapter** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **SEV-SNP adapter** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **DCAP offline verifier** | ✅ | ✅ | FIXTURE | ✅ | ❌ | ❌ |
| **VCEK offline verifier** | ✅ | ✅ | FIXTURE | ✅ | ❌ | ❌ |
| **DCAP online (PCCS)** | ❌ | — | — | ✅ | ❌ | ❌ |
| **AMD KDS online** | ❌ | — | — | ✅ | ❌ | ❌ |
| **AttestationPipeline** | ✅ | ✅ | FIXTURE | ✅ | ❌ | ❌ |
| **ClaimsGate** | ✅ | ✅ | — | ✅ | ❌ | ❌ |
| **ZkClaimsMapper** | ✅ | ✅ | FIXTURE | ✅ | ❌ | ❌ |
| **Release workflow (live KMS)** | ✅ | — | — | — | ❌ | ❌ |
| **Mainnet deployment** | ❌ | — | — | — | ❌ | ❌ |
| **External security audit** | ⚠️ docs | — | — | — | ❌ | ❌ |

---

## Security Remediation (commit `9562d22`)

| VULN | Status | Regression evidence |
|------|--------|---------------------|
| VULN-001 KMS stub metadata trust | **FIXED** | `provenance-live-kms.test.mjs` T-EXP-001A–F |
| VULN-004 Live provenance KMS verify | **FIXED** | `provenance-live-kms.test.mjs` T-EXP-004a–G |
| VULN-006 OIDC claim bindings fail-closed | **FIXED** | `kms-oidc.test.mjs` T-EXP-006A–F |
| VULN-007 Static Vault token in live mode | **FIXED** | `kms-oidc.test.mjs` T-EXP-007A–E |
| VULN-009 Stub mode Cloud HSM bypass | **FIXED** | `kms-signer.test.mjs` T-EXP-009A–C |
| VULN-010 elliptic in production tree | **FIXED** | `elliptic-supply-chain.test.mjs` T-EXP-010A–D |

---

## CI Enforcement Tiers

| Tier | Trigger | SHA-256 | ML-DSA | KMS live |
|------|---------|---------|--------|----------|
| PR / push | `aegis_repro_ci.yml` | **required** | WARN | not connected |
| Schedule / manual | `provenance-pqc-hardening` | **required** | **required** | not connected |
| Release tag | `release.yml` | **required** | **required** | **NOT VERIFIED** |
| KMS smoke | `security-kms-live-smoke.yml` | — | — | **NOT VERIFIED** |

---

## Known Gaps (honest status)

1. **Phase 8.14 Task 4:** PARTIAL — live Vault/HSM operator setup pending ([kms-live-operator-checklist.md](../operations/kms-live-operator-checklist.md))
2. **PR-tier `--require-pqc`:** WARN-only — Phase 8.15 promotion pending
3. **`aegis-provenance-prod-v1` registry key:** not committed (only `aegis-ci-mldsa87-v1`)
4. **Migration debt:** 8 allowlisted binary paths ([repository-boundary-report.md](../security/repository-boundary-report.md))
5. **Circuit `.circom` source:** lost — behavioral oracle only ([known-limitations.md](../../audit-ready/known-limitations.md))

---

## References

- [cryptographic-specification.md](./cryptographic-specification.md)
- [threat-model.md](./threat-model.md)
- [ADR-0001](../adr/0001-frozen-core.md)
- [phase8.14-task4-completion-report.md](./phase8.14-task4-completion-report.md)
