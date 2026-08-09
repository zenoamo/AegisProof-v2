# AegisProof v2 — Security Test Catalog (Research Expansion)

**Status:** Phase E — additive negative test documentation  
**Suite:** `tests/security/research-negative.test.mjs`  
**Runner:** `node --test tests/security/research-negative.test.mjs` (+ optional penetration registration)

---

## Catalog Format

Each entry documents: Threat · Precondition · Attack · Expected rejection · Evidence

---

## T-RES-001 — Manifest replay (stale hash)

| Field | Value |
|-------|-------|
| **Threat** | Stale manifest accepted after artifact update |
| **Precondition** | Manifest entry sha256 does not match resolved artifact |
| **Attack** | Verify manifest with outdated zkey hash |
| **Expected rejection** | `verifyManifest` FAIL — hash mismatch |
| **Evidence** | `research-negative.test.mjs` T-RES-001 |

---

## T-RES-002 — Signature substitution

| Field | Value |
|-------|-------|
| **Threat** | Valid signature copied to different entry |
| **Precondition** | Two entries; signature from entry A |
| **Attack** | Attach A's signature to entry B payload |
| **Expected rejection** | `verifyEnvelope` FAIL |
| **Evidence** | `research-negative.test.mjs` T-RES-002 |

---

## T-RES-003 — Registry key mismatch

| Field | Value |
|-------|-------|
| **Threat** | Envelope references non-existent registry key |
| **Precondition** | Unknown `publicKeyId` |
| **Attack** | Verify envelope with fabricated keyId |
| **Expected rejection** | `validateEnvelopeKeyReference` FAIL |
| **Evidence** | `research-negative.test.mjs` T-RES-003 |

---

## T-RES-004 — OIDC claim spoof

| Field | Value |
|-------|-------|
| **Threat** | JWT from unintended repository accepted |
| **Precondition** | Live mode; bindings set for repo A |
| **Attack** | JWT claims repository B |
| **Expected rejection** | `OIDC_CLAIM_REJECTED` |
| **Evidence** | `research-negative.test.mjs` T-RES-004 |

---

## T-RES-005 — Stub/live mode confusion

| Field | Value |
|-------|-------|
| **Threat** | Stub KMS envelope accepted in live mode |
| **Precondition** | `KMS_BACKEND_MODE=live`; envelope `kmsStub=true` |
| **Attack** | Verify stub envelope on live path |
| **Expected rejection** | `KMS_STUB_FORBIDDEN_IN_LIVE_MODE` |
| **Evidence** | `research-negative.test.mjs` T-RES-005; also T-EXP-001A (remediation) |

---

## T-RES-006 — TEE evidence corruption

| Field | Value |
|-------|-------|
| **Threat** | Tampered offline fixture accepted |
| **Precondition** | `TEE_VERIFICATION=offline` |
| **Attack** | Corrupted fixture / invalid signature |
| **Expected rejection** | Offline verifier FAIL |
| **Evidence** | Delegates to `tee/tests/offline-verification.test.ts` (subprocess smoke) |

---

## T-RES-007 — Release metadata tamper

| Field | Value |
|-------|-------|
| **Threat** | Manifest integrity fields tampered |
| **Precondition** | Invalid `schemaVersion` or pinned hash |
| **Attack** | Modify top-level manifest metadata |
| **Expected rejection** | `verifyManifestIntegrity` FAIL |
| **Evidence** | `research-negative.test.mjs` T-RES-007 |

---

## T-RES-008 — Dependency substitution

| Field | Value |
|-------|-------|
| **Threat** | elliptic carrier in production tree |
| **Precondition** | `circomlibjs` must not be production dependency |
| **Attack** | Production npm tree includes elliptic |
| **Expected rejection** | `npm ls elliptic --omit=dev` empty |
| **Evidence** | `research-negative.test.mjs` T-RES-008; T-EXP-010A (remediation) |

---

## Relationship to Existing Suites

| Existing | Research catalog |
|----------|------------------|
| PT-02/03 provenance | T-RES-001, T-RES-007 extend coverage |
| PT-04 PQC | T-RES-002, T-RES-003 align |
| T-EXP-001/006/007 | T-RES-004/005 reference same semantics |
| T-EXP-010 | T-RES-008 aligns |

**No existing test expectations weakened.**

---

## References

- [threat-model.md](./threat-model.md)
- [penetration-test-plan.md](../security/penetration-test-plan.md)
