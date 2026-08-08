# KMS Live Operator Checklist — Phase 8.14

**Version:** 1.0  
**Date:** 2026-08-08  
**Status:** Operator procedure — live trust chain **NOT VERIFIED**  
**Scope:** GitHub Actions OIDC → Vault JWT auth → Vault Transit → KMS signer → provenance verification  

> **No secrets in this document.** Do not record Vault tokens, JWTs, private keys, HSM credentials, Authorization headers, or raw signing material anywhere in the repository.

---

## Current State (read before starting)

| Layer | Status |
|-------|--------|
| Implementation (Task 4 code + workflows + tests) | **COMPLETE** |
| Live Vault/HSM trust chain | **NOT VERIFIED** |
| Phase 8.14 Task 4 overall | **PARTIAL** |

Mock/unit test PASS **does not** constitute live integration PASS.  
Proceed only when each checkbox below is satisfied by operator action outside this repository.

---

## Trust chain overview

```
GitHub Actions (workflow_dispatch or tag push)
        │
        ▼  permissions: id-token: write
   OIDC JWT (GitHub-issued, short-lived)
        │
        ▼  claim binding validation (repository, owner, ref, workflow, environment, sub)
   Vault JWT auth  →  role: ci-provenance-signer
        │
        ▼  ephemeral client token (never logged, never committed)
   Vault Transit  →  key: aegis-provenance-prod-v1
        │
        ▼
   KMS signer  →  provenance manifest signatures
        │
        ▼
   Signature verify + provenance verify (--pqc)
```

Related docs:

- [vault-github-oidc.md](../security/vault-github-oidc.md) — OIDC trust chain design
- [kms-key-rotation-runbook.md](../security/kms-key-rotation-runbook.md) — rotation / revocation
- [kms-hsm-architecture.md](../security/kms-hsm-architecture.md) — architecture and RACI

---

## Step 1 — Vault prerequisites

Complete before any GitHub workflow live run.

```text
[ ] Vault production instance available
[ ] TLS enabled (HTTPS only for VAULT_ADDR)
[ ] Vault audit logging enabled
[ ] JWT/OIDC auth method enabled (GitHub Actions issuer)
[ ] Transit secrets engine enabled
[ ] Network access restricted (GitHub Actions egress → Vault only as needed)
[ ] Vault health endpoint reachable from protected runner network
[ ] Namespace policy reviewed (if VAULT_NAMESPACE used)
```

**Do not** export private key material from Vault or HSM.

---

## Step 2 — Transit key

**Target key:** `aegis-provenance-prod-v1`

```text
[ ] Key exists in Transit mount (default: transit)
[ ] Algorithm matches ML-DSA-87 (provenance policy)
[ ] Key is non-exportable (export denied by policy)
[ ] Signing operation allowed for ci-provenance-signer policy
[ ] Verification operation available for ci-provenance-signer policy
[ ] Rotation policy documented (see kms-key-rotation-runbook.md)
[ ] Revocation procedure documented
[ ] Key version tracked for audit
```

Verify public metadata only — **never retrieve secret key bytes**.

---

## Step 3 — GitHub OIDC trust (Vault role)

**Vault role name:** `ci-provenance-signer`

Configure restrictive claim binding on the Vault JWT/OIDC role.  
Requests from any value outside binding → **reject**.

| Claim | Expected binding (example) | Check |
|-------|---------------------------|-------|
| `repository` | `zenoamo/AegisProof-v2` | [ ] |
| `repository_owner` | `zenoamo` | [ ] |
| `ref` | `refs/tags/v*` (release) or branch pattern for smoke | [ ] |
| `workflow` | `Release` or `KMS Live Smoke` | [ ] |
| `environment` | `release-signing` or `kms-live-smoke` | [ ] |
| `sub` | Optional explicit subject binding | [ ] |

```text
[ ] repository binding configured
[ ] repository_owner binding configured
[ ] ref binding configured (tag vs branch per workflow)
[ ] workflow binding configured
[ ] environment binding configured
[ ] subject binding configured (if used)
[ ] Requests from other repositories rejected
[ ] Requests from other branches/tags rejected
[ ] Requests from other workflows rejected
[ ] Requests from other environments rejected
```

Repository-side enforcement mirrors Vault via `KMS_OIDC_EXPECT_*` environment variables in workflows (see [vault-github-oidc.md](../security/vault-github-oidc.md)).

---

## Step 4 — Vault policy (least privilege)

Policy attached to `ci-provenance-signer` role:

```text
[ ] Sign access only on aegis-provenance-prod-v1 (and smoke key if separate)
[ ] Verify access only where required (same key)
[ ] No key export capability
[ ] No key deletion capability
[ ] No arbitrary Transit mount access
[ ] No administrative Vault access (policy admin, auth config, seal, etc.)
[ ] No access to unrelated secret engines
[ ] Token TTL bounded (recommended: 15m max)
```

GitHub Actions identity must not receive broader Vault capabilities than provenance signing requires.

---

## Step 5 — GitHub protected environments

### `release-signing`

Used by: `.github/workflows/release.yml` (tag push)

```text
[ ] Environment exists in GitHub repository settings
[ ] Required reviewers configured (recommended: 2-of-3 release officers)
[ ] Deployment branch restriction: tags only (v*.*.*)
[ ] Secret VAULT_ADDR stored in environment (not in repository files)
[ ] No VAULT_TOKEN stored as permanent GitHub secret (OIDC ephemeral only)
[ ] No private key stored in repository or GitHub secrets
[ ] OIDC permission limited to Release workflow
```

### `kms-live-smoke`

Used by: `.github/workflows/security-kms-live-smoke.yml` (workflow_dispatch)

```text
[ ] Environment exists
[ ] Required reviewers configured (recommended: security + platform)
[ ] Deployment branch restriction appropriate for smoke testing
[ ] Secret VAULT_ADDR stored in environment
[ ] No private key in repository
[ ] OIDC permission limited to KMS Live Smoke workflow
```

### Workflow permissions (OIDC workflows only)

```yaml
permissions:
  id-token: write
  contents: read   # release workflow adds contents: write for gh-release step only
```

```text
[ ] id-token: write present only on OIDC workflows
[ ] No unnecessary contents: write on PR CI
[ ] No secrets.* write permissions
[ ] PR CI does not connect to live Vault
```

---

## Step 6 — Public key registry

**Required file:** `artifacts/provenance/public-keys/aegis-provenance-prod-v1.json`

```text
[ ] keyId field = aegis-provenance-prod-v1
[ ] algorithm = ML-DSA-87
[ ] Public key hex matches Vault Transit key (fingerprint/hash verified out-of-band)
[ ] Domain policy aligns with AEGIS_ARTIFACT_PROVENANCE_V1
[ ] status = active (when committed)
[ ] immutable = true
[ ] No privateKey, secretKey, or token fields present
[ ] Registry commit reviewed before first live release
```

Compare public key fingerprint/hash with Vault operator console — **do not export private material**.

---

## Step 7 — Environment configuration

Set in GitHub protected environments or workflow `env` — **never commit values**.

| Variable | Purpose | Stored in repo? |
|----------|---------|-----------------|
| `KMS_BACKEND_MODE` | Must be `live` for smoke/release | No (workflow env) |
| `AEGIS_PROVENANCE_SIGNING` | `kms` for release signing | No |
| `AEGIS_PROVENANCE_BACKEND` | `vault-transit` | No |
| `AEGIS_PROVENANCE_KEY_ID` | `aegis-provenance-prod-v1` | No |
| `VAULT_ADDR` | Vault API URL | GitHub secret only |
| `VAULT_JWT_ROLE` | `ci-provenance-signer` | No (workflow env) |
| `VAULT_TRANSIT_MOUNT` | `transit` (default) | No |
| `KMS_OIDC_EXPECT_REPOSITORY` | From `github.repository` | No |
| `KMS_OIDC_EXPECT_OWNER` | From `github.repository_owner` | No |
| `KMS_OIDC_EXPECT_REF` | From `github.ref` | No |
| `KMS_OIDC_EXPECT_WORKFLOW` | Workflow name | No |
| `KMS_OIDC_EXPECT_ENVIRONMENT` | Environment name | No |

```text
[ ] KMS_BACKEND_MODE=live configured for smoke/release jobs
[ ] VAULT_ADDR configured in protected environment secret
[ ] VAULT_JWT_ROLE=ci-provenance-signer configured
[ ] AEGIS_PROVENANCE_KEY_ID=aegis-provenance-prod-v1 configured
[ ] OIDC claim expectations match Vault role bindings
[ ] VAULT_TOKEN is NOT stored as permanent repository secret
[ ] OIDC → Vault JWT login provides ephemeral token per job
```

---

## Step 8 — Protected live smoke (first live test)

**Prerequisite:** Steps 1–7 complete.

Trigger manually:

```text
GitHub → Actions → KMS Live Smoke → Run workflow
Environment: kms-live-smoke
```

Expected flow:

```text
GitHub OIDC JWT acquisition
    ↓
validateOidcClaimBindings (repository, owner, ref, workflow, environment, sub)
    ↓
Vault JWT login (role: ci-provenance-signer)
    ↓
Transit sign (test payload)
    ↓
Transit verify
    ↓
Job exit 0
```

Script: `scripts/run-kms-live-smoke.mjs`  
Workflow: `.github/workflows/security-kms-live-smoke.yml`

```text
[ ] workflow_dispatch triggered manually (not on PR)
[ ] Job selected kms-live-smoke environment
[ ] OIDC step succeeded
[ ] Vault auth succeeded
[ ] Sign succeeded
[ ] Verify succeeded
[ ] No stub fallback occurred
[ ] No secrets appeared in workflow logs
```

---

## Step 9 — Failure conditions (all = FAIL)

Any of the following must fail the workflow (fail closed):

```text
[ ] Vault unreachable
[ ] OIDC authentication failure
[ ] Invalid JWT
[ ] Wrong repository
[ ] Wrong repository_owner
[ ] Wrong ref / branch / tag
[ ] Wrong workflow name
[ ] Wrong environment
[ ] Wrong subject (if bound)
[ ] Unknown keyId
[ ] Wrong algorithm
[ ] Sign failure
[ ] Verify failure
[ ] Expired token / zero lease_duration
[ ] Missing registry public key
[ ] Signature mismatch
[ ] Live mode stub fallback (forbidden by design)
```

If smoke fails → **do not proceed to release**. Fix operator configuration first.

---

## Step 10 — Live evidence (after smoke PASS only)

Record **non-secret** evidence in operator ticket / runbook (not in git unless sanitized):

| Field | Example | Record? |
|-------|---------|---------|
| Workflow run ID | `123456789` | Yes |
| Commit SHA | `b05c7e8...` | Yes |
| Repository | `zenoamo/AegisProof-v2` | Yes |
| Branch / tag | `refs/heads/master` or `refs/tags/v2.0.2` | Yes |
| Environment | `kms-live-smoke` | Yes |
| keyId | `aegis-ci-mldsa87-v1` (smoke) | Yes |
| Algorithm | `ML-DSA-87` | Yes |
| Timestamp | ISO8601 | Yes |
| Signature verification | PASS / FAIL | Yes |
| Provenance verification | PASS / FAIL / N/A | Yes |

**Never record:**

```text
Vault token
OIDC JWT
Private key
HSM credential
Secret values
Authorization header
Raw signing material
```

---

## Step 11 — Live verification (after smoke PASS)

Only after Step 8 smoke PASS:

```bash
# Operator workstation or CI with live env — not PR tier
npm run verify:provenance -- --manifest artifacts/provenance/manifest.json --pqc
```

With live KMS envelopes present, verification uses Vault Transit verify path.

```text
[ ] Smoke PASS recorded
[ ] Provenance verify with --pqc PASS (when KMS-signed manifest exists)
[ ] Public key registry matches Vault key
[ ] Audit logs reviewed for sign/verify events
```

Status transition (only after real smoke success):

```text
Task 4: PARTIAL  →  LIVE VERIFIED
```

**Do not mark LIVE VERIFIED until workflow_dispatch smoke actually passes.**

---

## Step 12 — Release safety gate

**Do not perform production release until all PASS:**

```text
[ ] OIDC authentication (live smoke or release dry-run)
[ ] Vault claim binding verified
[ ] Transit signing verified
[ ] Signature verification verified
[ ] Public key registry committed and matches Vault
[ ] Provenance verification (--pqc) verified
[ ] Protected environment configured and reviewed
[ ] Audit logging confirmed
[ ] Frozen Core integrity confirmed (no diff on circuits/protocol/sdk/tee)
```

Release workflow order (`.github/workflows/release.yml`):

```text
tag push
  → OIDC
  → Vault authentication
  → KMS_BACKEND_MODE=live
  → generate:provenance (KMS sign)
  → verify:provenance --pqc
  → GitHub Release (includes manifest.json)
```

Any failure → release **FAIL** (no stub fallback).

---

## Step 13 — Frozen Core and repository safety

Before and after any operator action:

```bash
git diff -- circuits/ protocol/ packages/sdk/ tee/
npm run check:sensitive-files   # expect CRITICAL 0
```

```text
[ ] Frozen Core unchanged
[ ] v2.0.1 tag unchanged (do not retag for KMS provisioning)
[ ] No force push
[ ] No secrets committed
[ ] No release created until live gate PASS
```

---

## Step 14 — Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `OIDC_NOT_CONFIGURED` | Missing OIDC env or permissions | Check `id-token: write`, protected environment |
| `OIDC_CLAIM_REJECTED` | Claim binding mismatch | Align Vault role + `KMS_OIDC_EXPECT_*` |
| `VAULT_AUTH_FAILED` | Role/policy/JWT issuer | Review Vault auth config and role |
| `VAULT_NOT_CONFIGURED` | Missing VAULT_ADDR or auth path | Check GitHub secret + JWT role |
| `VAULT_SIGN_FAILED` | Unknown Transit key or policy | Verify key name and policy paths |
| `INVALID_CONFIG` unknown keyId | Registry missing public key | Commit registry JSON first |
| Stub signature in live mode | Misconfiguration | **FAIL** — fix env; stub fallback forbidden |

If Vault or GitHub provisioning cannot be completed in-repo:

```text
BLOCKED — operator configuration required
```

Do not modify Frozen Core to work around operator gaps.

---

## Step 15 — Status reporting template

Use after smoke attempt (update only with real results):

## Live KMS Integration Status

| Check | Status |
|-------|--------|
| Vault connectivity | PASS / **NOT VERIFIED** |
| OIDC authentication | PASS / **NOT VERIFIED** |
| Claim binding | PASS / **NOT VERIFIED** |
| Transit signing | PASS / **NOT VERIFIED** |
| Signature verification | PASS / **NOT VERIFIED** |
| Public key registry | PASS / **NOT VERIFIED** |
| Protected environment | PASS / **NOT VERIFIED** |
| Provenance verification | PASS / **NOT VERIFIED** |

```text
Phase 8.14 Task 4: PARTIAL / LIVE VERIFIED
Implementation: COMPLETE
Live Vault/HSM: NOT VERIFIED  (until smoke PASS)
```

---

## Separation of concerns (mandatory)

| Statement | True today? |
|-----------|-------------|
| Code implementation is complete | **Yes** |
| Production trust chain is verified | **No** |
| Mock tests prove live Vault works | **No** |
| Safe to production release without smoke | **No** |

Maintain this separation in all status reports until `workflow_dispatch` live smoke succeeds.

---

## Related workflows and scripts

| Asset | Path |
|-------|------|
| Live smoke workflow | `.github/workflows/security-kms-live-smoke.yml` |
| Release workflow | `.github/workflows/release.yml` |
| Smoke script | `scripts/run-kms-live-smoke.mjs` |
| OIDC auth module | `scripts/lib/kms-backends/vault-auth.mjs` |
| KMS provenance | `scripts/lib/kms-provenance.mjs` |
| OIDC tests (mocked) | `npm run test:kms-oidc` |

PR CI runs `npm run test:kms-signer` and `npm run test:kms-oidc` in stub/mock mode only — **not live Vault**.
