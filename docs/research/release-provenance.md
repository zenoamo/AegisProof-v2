# AegisProof v2 — Release Provenance (Research)

**Status:** Research documentation (Phase B)  
**Scope:** Tag release signing chain design — **live path NOT VERIFIED**

---

## 1. Release Architecture

```
git tag v*.*.*
    → release.yml (protected environment: release-signing)
    → GitHub OIDC JWT
    → Vault JWT auth (role: ci-provenance-signer)
    → Vault Transit sign (key: aegis-provenance-prod-v1)
    → generate:provenance (KMS mode)
    → verify:provenance --manifest --pqc (strict)
    → GitHub Release + manifest attachment
```

**Status:** Workflow **IMPLEMENTED** — end-to-end **NOT VERIFIED** (operator setup pending)

---

## 2. Trust Boundaries

| Layer | Trust | Verified |
|-------|-------|----------|
| Git tag immutability | GitHub | ✅ platform |
| Workflow identity | GitHub OIDC | ❌ live |
| Vault authentication | JWT role + claim bindings | ❌ live |
| Signing key | Vault Transit | ❌ live |
| Manifest hashes | SHA-256 local | ✅ |
| PQC signatures | ML-DSA-87 via KMS | ❌ live KMS |

---

## 3. Required Operator Artifacts

Per [kms-live-operator-checklist.md](../operations/kms-live-operator-checklist.md):

1. Vault instance with JWT auth + Transit key
2. GitHub protected environment `release-signing` + `VAULT_ADDR` secret
3. Public key registry: `artifacts/provenance/public-keys/aegis-provenance-prod-v1.json` — **not yet committed**
4. OIDC claim bindings (`KMS_OIDC_EXPECT_*`) matching Vault role

---

## 4. Verification Modes at Release

| Check | Command | Required |
|-------|---------|----------|
| Sensitive files | `check:sensitive-files` | ✅ pre-release smoke |
| Phase 8.13 gate | `test:phase813-gate` | ✅ pre-release smoke |
| Manifest generation | `generate:provenance` (live KMS) | ✅ release job |
| Strict verify | `verify:provenance --manifest --pqc` | ✅ release job |

---

## 5. Failure Semantics

Release workflow **must fail** on:
- OIDC auth failure
- Vault sign failure
- Manifest hash mismatch
- PQC/KMS verify failure

Fail-closed semantics preserved in remediation `9562d22` — do not weaken.

---

## 6. Research vs Production

| Aspect | Research/demo | Production release |
|--------|---------------|-------------------|
| KMS backend | stub / mock | Vault Transit |
| OIDC | mocked in tests | GitHub Actions live |
| Registry key | `aegis-ci-mldsa87-v1` | `aegis-provenance-prod-v1` |
| Verification label | `MOCKED` / `FIXTURE` | Requires operator smoke PASS |

**Do not label research demo output as LIVE PRODUCTION VERIFIED.**

---

## 7. Residual Gaps

1. Phase 8.14 Task 4 = PARTIAL
2. No recorded KMS Live Smoke PASS
3. PR-tier still WARN-only for PQC (pre-release uses strict in release job only)

---

## References

- [vault-github-oidc.md](../security/vault-github-oidc.md)
- [kms-key-rotation-runbook.md](../security/kms-key-rotation-runbook.md)
- [phase8.14-task4-completion-report.md](./phase8.14-task4-completion-report.md)
- [v2.0.1-release-notes.md](../release/v2.0.1-release-notes.md)
