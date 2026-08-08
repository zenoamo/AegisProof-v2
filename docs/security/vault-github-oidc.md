# GitHub OIDC → Vault Transit — Production Signing Trust Chain

**Version:** 1.0  
**Date:** 2026-08-08  
**Phase:** 8.14 Task 4  
**Scope:** CI/release provenance signing only — Groth16 core frozen  

> **No credentials in this document.** Vault tokens, OIDC secrets, HSM credentials, and private keys are managed exclusively in GitHub protected environments and Vault/HSM infrastructure.

---

## 1. Trust chain overview

```
GitHub Actions (workflow job)
        │
        ▼  permissions: id-token: write
   OIDC JWT (GitHub-issued, short-lived)
        │
        ▼  POST /v1/auth/jwt/login
   Vault JWT auth method
        │
        ▼  role: ci-provenance-signer (restrictive claim binding)
   Vault client token (lease-bound, never logged)
        │
        ▼  POST /v1/transit/sign/{key}
   Vault Transit (ML-DSA-87 provenance key)
        │
        ▼
   Provenance manifest signatures
```

Module: `scripts/lib/kms-backends/vault-auth.mjs`  
Integration: `scripts/lib/kms-provenance.mjs`, `scripts/generate-provenance-manifest.mjs`

---

## 2. Vault auth method

Enable JWT/OIDC auth on Vault (operator task — not in repository):

```hcl
# Example — apply via Vault operator, NOT committed to git
vault auth enable jwt

vault write auth/jwt/config \
  oidc_discovery_url="https://token.actions.githubusercontent.com" \
  bound_issuer="https://token.actions.githubusercontent.com"
```

For GitHub Actions OIDC, Vault validates JWT signatures against GitHub's JWKS.  
The repository stores **claim binding expectations** only (`KMS_OIDC_EXPECT_*` env vars in workflows).

---

## 3. Role configuration — `ci-provenance-signer`

Restrictive role binding minimum claims:

| Claim | Binding | Purpose |
|-------|---------|---------|
| `repository` | `zenoamo/AegisProof-v2` | Reject forks and foreign repos |
| `repository_owner` | `zenoamo` | Owner-level guard |
| `ref` | `refs/tags/v*` (release) | Tag-only signing for release workflow |
| `workflow` | `Release` or `KMS Live Smoke` | Workflow name lock |
| `environment` | `release-signing` / `kms-live-smoke` | Protected environment gate |
| `sub` | Optional explicit subject | Fine-grained identity |

Example role (operator — no secrets):

```hcl
vault write auth/jwt/role/ci-provenance-signer \
  role_type="jwt" \
  user_claim="sub" \
  bound_audiences="https://vault.example.com" \
  bound_claims_type="string" \
  bound_claims='{"repository":"zenoamo/AegisProof-v2","repository_owner":"zenoamo"}' \
  token_policies="ci-provenance-signer" \
  token_ttl="15m" \
  token_max_ttl="30m"
```

Requests from repositories, branches, workflows, or environments outside binding → **reject** (fail closed).

---

## 4. Transit mount and signing key

| Setting | Release default | Smoke test default |
|---------|-----------------|-------------------|
| Mount | `transit` (`VAULT_TRANSIT_MOUNT`) | same |
| Key | `aegis-provenance-prod-v1` | `aegis-ci-mldsa87-v1` |
| Algorithm | ML-DSA-87 (via HSM-backed Transit key) | same |

Public key must exist in `artifacts/provenance/public-keys/{keyId}.json` before verification succeeds.

Transit policy (operator):

```hcl
path "transit/sign/aegis-provenance-prod-v1" {
  capabilities = ["update"]
}
path "transit/verify/aegis-provenance-prod-v1" {
  capabilities = ["update"]
}
```

Signing and verification use domain-separated payloads from `entrySignPayload()` — hash semantics unchanged from Phase 8.13.

---

## 5. Policy — `ci-provenance-signer`

Minimum permissions:

| Path | Capability | Notes |
|------|------------|-------|
| `auth/jwt/login` | use (implicit) | OIDC exchange |
| `transit/sign/{provenance-key}` | update | Sign only |
| `transit/verify/{provenance-key}` | update | Post-sign verify |
| `sys/health` | read | Optional readiness |

**Denied:** key export, transit key creation, policy admin, unrelated mounts.

---

## 6. TTL and token lifecycle

| Parameter | Recommended | Rationale |
|-----------|-------------|-----------|
| `token_ttl` | 15m | Short-lived CI session |
| `token_max_ttl` | 30m | Upper bound |
| GitHub OIDC JWT | ~5m | GitHub-issued lifetime |

`vault-auth.mjs` validates `lease_duration > 0` after login. Tokens are cached in-process only for the job duration — never written to disk or logs.

---

## 7. GitHub Actions integration

### Permissions (OIDC workflows only)

```yaml
permissions:
  id-token: write
  contents: read   # release workflow adds contents: write for gh-release
```

PR CI (`aegis_repro_ci.yml`) does **not** request `id-token: write` and does **not** connect to live Vault.

### Workflows

| Workflow | Trigger | Environment | Live Vault |
|----------|---------|-------------|------------|
| `release.yml` | tag push | `release-signing` | Yes — provenance sign + verify |
| `security-kms-live-smoke.yml` | `workflow_dispatch` | `kms-live-smoke` | Yes — sign/verify smoke only |
| `aegis_repro_ci.yml` | push/PR | none | No — stub KMS tests |

### Required GitHub secrets (protected environments)

| Secret | Purpose |
|--------|---------|
| `VAULT_ADDR` | Vault API URL |

No `VAULT_TOKEN` in GitHub — OIDC exchange provides ephemeral token per job.

---

## 8. Environment variables

| Variable | Required (live) | Description |
|----------|-----------------|-------------|
| `KMS_BACKEND_MODE` | Yes | Must be `live` |
| `AEGIS_PROVENANCE_SIGNING` | Yes (release) | `kms` |
| `VAULT_ADDR` | Yes | From GitHub secret |
| `VAULT_JWT_ROLE` | Yes | `ci-provenance-signer` |
| `VAULT_TRANSIT_MOUNT` | No | Default `transit` |
| `AEGIS_PROVENANCE_KEY_ID` | Yes | Registry key ID |
| `KMS_OIDC_EXPECT_*` | Yes (release) | Claim bindings |

Static `VAULT_TOKEN` supported for operator workstations — never commit.

---

## 9. Rotation

See [kms-key-rotation-runbook.md](./kms-key-rotation-runbook.md).

Overlap period: old + new keys in registry with `status: rotating`.  
Vault Transit key version incremented; registry updated before old key retirement.

---

## 10. Revocation

| Event | Action |
|-------|--------|
| Compromised OIDC role | Disable Vault role; rotate JWT auth config |
| Compromised Transit key | Disable key version; emergency rotation runbook |
| Rogue workflow attempt | Claim binding rejects at `validateOidcClaimBindings()` |

---

## 11. Audit logging

Vault audit device (operator): log all `transit/sign`, `transit/verify`, and `auth/jwt/login` events.  
GitHub Actions: retain workflow logs for release and smoke jobs.  
Repository: no tokens or signatures of secrets in logs — `redactKmsSecrets()` enforced.

---

## 12. Recovery

| Failure | Behavior |
|---------|----------|
| Vault unreachable | Release job **FAIL** — no stub fallback |
| OIDC auth failure | Release job **FAIL** |
| Invalid claim | `OIDC_CLAIM_REJECTED` — **FAIL** |
| Unknown registry key | `INVALID_CONFIG` — **FAIL** |
| Signing failure | `KMS_SIGN_FAILED` — **FAIL** |
| Verification failure | `verify:provenance --pqc` exit 1 — **FAIL** |

Recovery: fix Vault/GitHub environment config, re-run tag push or `workflow_dispatch` smoke test.

---

## 13. Tests

| Command | Scope |
|---------|-------|
| `npm run test:kms-oidc` | OIDC claim binding, auth failures, redaction (mocked) |
| `npm run test:kms-signer` | Task 3 hardening + signer (stub, no live Vault) |
| `workflow_dispatch` smoke | Live integration (protected env only) |

**Do not report live PASS without actual Vault connectivity.**

---

## 14. Related documents

- [kms-hsm-architecture.md](./kms-hsm-architecture.md)
- [kms-signer-design.md](./kms-signer-design.md)
- [kms-key-rotation-runbook.md](./kms-key-rotation-runbook.md)
