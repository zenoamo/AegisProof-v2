# Phase 8.14 Task 2 Completion Report

**Task:** KMS Signer Abstraction Layer  
**Date:** 2026-08-08  
**Status:** Complete  

> **Groth16 core is permanently frozen.** No private keys persisted. No secrets committed. No changes to `circuits/`, `protocol/`, `packages/sdk/`, `tee/`, or verifier contracts.

---

## Changed Files

| File | Action |
|------|--------|
| `scripts/lib/kms-signer.mjs` | **Created** — KMS/HSM signer abstraction |
| `scripts/run-kms-signer.mjs` | **Created** — test runner |
| `tests/security/kms-signer.test.mjs` | **Created** — T-KMS-01..06 |
| `docs/security/kms-signer-design.md` | **Created** — module design doc |
| `docs/research/phase8.14-task2-completion-report.md` | **Created** — this report |
| `package.json` | Added `test:kms-signer` |
| `.github/workflows/aegis_repro_ci.yml` | Added KMS tests to `security-boundary-check` |

---

## Architecture

`kms-signer.mjs` provides backend-agnostic signing for provenance and operator auth roles:

| Backend | Status | Private key handling |
|---------|--------|---------------------|
| `mock-hsm` | Implemented | In-memory `test-*` keys only; never exported |
| `vault-transit` | Stub (no network) | Registry public key; stub signature |
| `cloud-hsm` | Interface only | `NOT_IMPLEMENTED` on sign |

Public API: `createSigner()`, `verifySignerConfiguration()`, `signPayload()`, `getPublicKeyMetadata()`, `verifySignedPayload()`.

`exportPrivateKeyMaterial()` always throws `EXPORT_FORBIDDEN`.

See [kms-signer-design.md](../security/kms-signer-design.md) and [kms-hsm-architecture.md](../security/kms-hsm-architecture.md).

---

## Security Boundary Verification

| Check | Result |
|-------|--------|
| Private key persisted to disk | **No** |
| Private key committed to git | **No** |
| `exportPrivateKeyMaterial()` | **Always throws** |
| Raw key in `signPayload` response | **No** |
| mock-hsm requires `test-` prefix | **Yes** |
| Vault live connection | **Disabled (stub)** |
| Frozen paths modified | **No** |
| Groth16 verifier path connected | **No** |

---

## Test Result

| Suite | Result |
|-------|--------|
| `test:kms-signer` (T-KMS-01..06) | **PASS** 26/26 |
| `test:penetration` | **PASS** 91/91 |
| `test:phase813-gate` | **PASS** 21/21 |
| `test:pqc-signature` | **PASS** 27/27 |

### T-KMS Matrix

| ID | Test | Result |
|----|------|--------|
| T-KMS-01 | Valid signer configuration | **PASS** |
| T-KMS-02 | Unknown keyId reject | **PASS** |
| T-KMS-03 | Algorithm mismatch reject | **PASS** |
| T-KMS-04 | Private key export reject | **PASS** |
| T-KMS-05 | Signature verification success | **PASS** |
| T-KMS-06 | Domain separation mismatch | **PASS** |

---

## Performance Impact

Negligible — abstraction layer invoked only in unit tests. No change to prover or verify hot paths.

---

## CI Integration

Added to `security-boundary-check` (PR/push):

```yaml
- name: KMS signer abstraction tests (T-KMS)
  run: npm run test:kms-signer
```

Runs after penetration tests; lightweight (~1s).

---

## Remaining Technical Debt

1. Vault Transit live OIDC client (Task 3)
2. Cloud HSM adapter implementation (Task 3+)
3. Wire `kms-signer` into `generate-provenance-manifest.mjs` (Task 3)
4. PR-tier `--require-pqc` promotion (Task 4+)
5. `test:kms-signer` not yet in T-813 required script list (optional)

---

## Next Recommendation

**Phase 8.14 Task 3:** Manifest signing automation — integrate `signPayload()` into provenance generation with Vault stub → OIDC path; still no production private keys in repository.

---

## Task 1 Pre-Start Verification (Read-Only)

| Document | Confirmed |
|----------|-----------|
| `kms-hsm-architecture.md` | Trust boundary, lifecycle, OIDC flow |
| `phase8.14-task1-completion-report.md` | Design-only; no keys generated |

---

- **Frozen core unchanged**
- **Phase 8.13 tests remain PASS**
- **No secrets introduced**
