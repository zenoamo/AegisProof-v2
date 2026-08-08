# Phase 8.14 Task 4 Completion Report

**Date:** 2026-08-08  
**Status:** Partial — implementation complete; live Vault/HSM integration requires operator setup  
**Prior commit:** Task 3 `d9a70e6` (pushed to origin/master)

---

## 1. Changed Files

| File | Purpose |
|------|---------|
| `scripts/lib/kms-backends/vault-auth.mjs` | OIDC JWT fetch, claim binding, Vault JWT login, token TTL |
| `scripts/lib/kms-backends/env.mjs` | OIDC-capable Vault env validation |
| `scripts/lib/kms-backends/vault-transit.mjs` | Async OIDC token resolution for Transit |
| `scripts/lib/kms-backends/http-fetch.mjs` | OIDC JWT redaction |
| `scripts/lib/kms-provenance.mjs` | KMS manifest sign/verify integration |
| `scripts/lib/kms-signer.mjs` | Live mode error message includes OIDC |
| `scripts/generate-provenance-manifest.mjs` | KMS signing path when live/kms mode |
| `scripts/verify-provenance-manifest.mjs` | KMS envelope verification |
| `scripts/run-kms-live-smoke.mjs` | Protected workflow smoke script |
| `scripts/run-kms-oidc.mjs` | Test runner |
| `tests/security/kms-oidc.test.mjs` | T-KMS-OIDC-01–16 |
| `.github/workflows/release.yml` | OIDC → Vault → live provenance → verify → release |
| `.github/workflows/security-kms-live-smoke.yml` | workflow_dispatch live smoke |
| `docs/security/vault-github-oidc.md` | OIDC trust chain documentation |
| `docs/security/kms-key-rotation-runbook.md` | Rotation / revocation runbook |
| `docs/README.md` | Doc index update |
| `README.md` | Phase 8.14 status |
| `package.json` | `test:kms-oidc` script |

---

## 2. OIDC → Vault Architecture

```
GitHub Actions (id-token: write)
    → OIDC JWT
    → validateOidcClaimBindings (repository, owner, ref, workflow, environment, sub)
    → Vault auth/jwt/login (role: ci-provenance-signer)
    → ephemeral Vault token (never logged)
    → transit/sign + transit/verify
    → provenance manifest signatures
```

---

## 3. Security Boundary

| Rule | Status |
|------|--------|
| Frozen Core unchanged | Verified |
| No secrets in repo | Verified |
| PR CI no live Vault | Verified — stub KMS tests only |
| Live → stub fallback forbidden | Enforced |
| Token redaction | `redactKmsSecrets()` |
| Release failures on auth/sign/verify errors | Workflow design |

---

## 4. Test Results

| Command | Result |
|---------|--------|
| `npm run test:kms-signer` | PASS — 59 checks (36 + 23) |
| `npm run test:kms-oidc` | PASS — 46 checks |
| `npm run test:penetration` | PASS — 91 checks |
| `npm run test:pqc-signature` | PASS — 27 checks |
| `npm run test:phase813-gate` | PASS — 21 checks |
| `npm run validate:doc-links` | PASS — 79 links |
| `npm run check:sensitive-files` | PASS — CRITICAL 0 |
| `npm run verify:provenance -- --live` | PASS (PQC unsigned WARN expected) |

---

## 5. Live Integration Status

| Integration | Status |
|-------------|--------|
| GitHub OIDC workflow wiring | **Implemented** (release + smoke) |
| Vault JWT auth module | **Implemented** |
| Live Vault Transit sign | **Not tested in this session** — requires operator Vault + protected GitHub environment |
| Release workflow live PASS | **Blocked on operator setup** (`VAULT_ADDR` secret, Vault role, Transit key, prod registry key) |

**No live Vault/HSM connection was made during Task 4 implementation.**

---

## 6. Frozen Core Verification

```
circuits/       → no diff
protocol/       → no diff
packages/sdk/   → no diff
tee/            → no diff
```

---

## 7. Remaining Risks

1. `aegis-provenance-prod-v1` public key not yet in registry — required before first live release
2. Vault JWT role + Transit key must be provisioned by operator
3. GitHub protected environments (`release-signing`, `kms-live-smoke`) must be configured with `VAULT_ADDR`
4. PR-tier `--require-pqc` promotion still pending

---

## 8. Phase 8.14 Task 4 = **Partial**

Implementation and mocked tests complete. Live integration PASS requires operator Vault/HSM provisioning and protected environment smoke test.
