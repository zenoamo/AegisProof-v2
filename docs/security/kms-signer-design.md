# KMS Signer Design — Phase 8.14 Task 2

**Version:** 1.1  
**Date:** 2026-08-08  
**Module:** `scripts/lib/kms-signer.mjs` + `scripts/lib/kms-backends/*`  
**Phase:** 8.14 Task 3 (live backend hardening)

> Groth16 core frozen. KMS signer operates on provenance and operator auth layers only.

---

## Purpose

Provide a backend-agnostic signing interface for:

| Role | Algorithm | Domain |
|------|-----------|--------|
| `provenance` | ML-DSA-87 | `AEGIS_ARTIFACT_PROVENANCE_V1` |
| `operator-pqc` | ML-DSA-87 | `AEGIS_AUTH_ENVELOPE_V1` |
| `operator-classical` | ECDSA secp256k1 | `AEGIS_AUTH_ENVELOPE_V1` |

Provenance payloads use `entrySignPayload()` + `buildSignMessage()`.  
Operator payloads use `createDeploymentAuthPayload()` + `buildAuthSignMessage()`.

---

## Public API

| Function | Description |
|----------|-------------|
| `createSigner(config)` | Construct signer handle after config validation |
| `verifySignerConfiguration(config)` | Validate backend, keyId, role, algorithm, domain |
| `signPayload(signer, payload)` | Sign via backend; returns signature metadata only |
| `getPublicKeyMetadata(signer)` | Public key + keyId; **never** returns private material |
| `verifySignedPayload(signer, payload, result)` | Verify using public metadata |
| `exportPrivateKeyMaterial()` | **Always throws** `EXPORT_FORBIDDEN` |

---

## Backends

### 1. `mock-hsm` (unit tests only)

- In-memory slot table (`mockHsmSlots`) — not persisted
- `keyId` must use `test-` prefix
- Test keys registered via `registerMockHsmTestKey()` or auto-generated in mock slot
- Uses `@noble/post-quantum` ML-DSA-87 or Node ECDSA internally
- Private key never returned from public API

### 2. `vault-transit` (live + stub)

- **Live:** `VAULT_ADDR` + `VAULT_TOKEN` with `KMS_BACKEND_MODE=live` (or `VAULT_TRANSIT_FORCE_LIVE=1`)
- Calls Vault `transit/sign` and `transit/verify` over HTTP
- **Stub:** When Vault is not configured, returns deterministic `vault-stub-*` signatures (CI default)

Environment:

| Variable | Purpose |
|----------|---------|
| `VAULT_ADDR` | Vault API base URL |
| `VAULT_TOKEN` | Vault token (never commit) |
| `VAULT_TRANSIT_MOUNT` | Transit mount (default `transit`) |
| `VAULT_TRANSIT_KEY_PREFIX` | Optional prefix for key names |
| `VAULT_TRANSIT_HASH_ALGORITHM` | Override hash algorithm (default `sha2-256`) |
| `KMS_BACKEND_MODE` | `stub` (default) or `live` |

### 3. `local-openssl` (live, CI smoke bridge)

- Uses a local OpenSSL 3.5 signer service for ML-DSA-87 because Vault OSS Transit does not provide ML-DSA Transit keys.
- GitHub Actions authenticates to Vault with GitHub OIDC first; the short-lived Vault token is then presented to the local signer service.
- The signer service checks the Vault token via `auth/token/lookup-self` and requires the `ci-provenance-signer` policy before invoking OpenSSL. The Vault role/policy must therefore grant `read` on `auth/token/lookup-self`; without that capability the signer fails closed with `Vault authorization rejected`. The required policy name can be overridden on the signer host with `LOCAL_OPENSSL_REQUIRED_VAULT_POLICY`.
- Private key remains on the local signer host; it is never committed, uploaded to GitHub, or returned by the service.
- Configuration: `LOCAL_OPENSSL_SIGNER_URL`, optional `LOCAL_OPENSSL_KEY_ID` (default `aegis-ci-mldsa87-v1`), and on the signer host `LOCAL_OPENSSL_PRIVATE_KEY_PATH` / `OPENSSL_BIN`.
- Service entrypoint: `scripts/local-openssl-signer.mjs`.
- Deployment boundary: the signer service binds to `127.0.0.1` by default. `LOCAL_OPENSSL_SIGNER_URL` must therefore resolve from the GitHub Actions runner to the signer host through an explicitly provisioned network path (for example, a self-hosted runner on the signer host or an approved private/reverse-proxy endpoint). A GitHub-hosted runner cannot reach the signer host simply because the service is running on `127.0.0.1` elsewhere. The protected `KMS Live Smoke` workflow uses a self-hosted runner with labels `self-hosted`, `linux`, and `kms-signer`, starts `scripts/local-openssl-signer.mjs` on that runner, and connects to `http://127.0.0.1:8787`. The runner must provision OpenSSL 3.5 at `/opt/openssl-3.5/bin/openssl` and the ML-DSA-87 private key at `/etc/aegis/kms/aegis-ci-mldsa87-v1.pem`; the private key is never stored in GitHub.
- The live smoke first probes `/healthz`; signing is attempted only after the endpoint reports `backend=local-openssl` and `algorithm=ML-DSA-87`.

### 4. `cloud-hsm` (live)

Providers via `CLOUD_HSM_PROVIDER`:

| Provider | Env | Algorithms |
|----------|-----|------------|
| `http` | `CLOUD_HSM_SIGN_URL`, optional `CLOUD_HSM_VERIFY_URL` | ML-DSA via HSM gateway |
| `aws` / `aws-kms` | `AWS_KMS_KEY_ID`, `AWS_REGION` | ECDSA (`operator-classical` only) |
| `gcp` / `gcp-kms` | `GCP_KMS_KEY_NAME` | ECDSA (`operator-classical` only) |
| `azure` / `azure-keyvault` | `AZURE_KEY_VAULT_URL`, `AZURE_KEY_NAME` | ECDSA (`operator-classical` only) |

ML-DSA provenance signing on cloud KMS: use `vault-transit` or `http` HSM gateway — native AWS/GCP/Azure KMS do not expose ML-DSA-87 yet.

When not configured, `signPayload()` throws `NOT_IMPLEMENTED` (stub mode).

### Live vs stub mode

| `KMS_BACKEND_MODE` | Vault Transit | Cloud HSM |
|--------------------|---------------|-----------|
| `stub` (default, CI) | deterministic stub if Vault unset | throws unless provider env set |
| `live` | requires `VAULT_ADDR` + `VAULT_TOKEN`; **no stub fallback** | requires full provider config; **no stub fallback** |

CI default: `KMS_BACKEND_MODE=stub` via `run-kms-signer.mjs`. PR CI does not connect to live Vault/HSM.

### ML-DSA-87 boundary

| Role | Algorithm | Supported backends |
|------|-----------|-------------------|
| `provenance` | ML-DSA-87 | `mock-hsm`, `vault-transit`, `cloud-hsm`/`http` gateway |
| `operator-pqc` | ML-DSA-87 | same |
| `operator-classical` | ECDSA secp256k1 | all backends including aws/gcp/azure native KMS |

Native AWS/GCP/Azure KMS APIs document ECDSA/RSA/Ed25519 — not ML-DSA-87 in this adapter. Use Vault Transit or HTTP HSM gateway for ML-DSA provenance.

---

## Security Properties

| Requirement | Implementation |
|-------------|----------------|
| No private key export | `exportPrivateKeyMaterial()` always throws |
| No raw key in responses | `signPayload` / `getPublicKeyMetadata` omit secret fields |
| keyId-based operations | All backends keyed by `keyId` |
| Algorithm validation | Role → expected algorithm enforced in `verifySignerConfiguration` |
| Domain separation | `validatePayloadDomain()` before sign/verify |

---

## Configuration Shape

```javascript
{
  backend: "mock-hsm" | "vault-transit" | "local-openssl" | "cloud-hsm",
  keyId: "test-provenance-kms-01",  // test- prefix required for mock-hsm
  role: "provenance" | "operator-pqc" | "operator-classical",
  algorithm: "ML-DSA-87",           // optional; inferred from role
  domain: "AEGIS_ARTIFACT_PROVENANCE_V1"  // optional; inferred from role
}
```

---

## Tests

| ID | Case | File |
|----|------|------|
| T-KMS-01 | Valid signer configuration | `tests/security/kms-signer.test.mjs` |
| T-KMS-02 | Unknown keyId reject | same |
| T-KMS-03 | Algorithm mismatch reject | same |
| T-KMS-04 | Private key export reject | same |
| T-KMS-05 | Signature verification success | same |
| T-KMS-06 | Domain separation mismatch | same |
| T-KMS-07 | Vault Transit live sign (mocked HTTP) | same |
| T-KMS-08 | Cloud HSM HTTP gateway sign/verify | same |
| T-KMS-09 | AWS KMS rejects ML-DSA provenance role | same |
| T-KMS-10–18 | Live mode, auth, timeout, validation, redaction | `kms-backend-hardening.test.mjs` |
| T-LOCAL-01–05 | Local OpenSSL sign/verify, key binding, response/error handling | `local-openssl-backend.test.mjs` |

Run: `npm run test:kms-signer`

---

## CI Integration

`security-boundary-check` job runs `npm run test:kms-signer` after penetration tests.

---

## Phase 8.14 Task 4 live path

The live smoke path is intentionally split into two trust boundaries:

```text
GitHub Actions OIDC → Vault JWT auth/claims → short-lived Vault token → local OpenSSL signer → ML-DSA-87
```

Vault OSS remains the authentication/policy gate; OpenSSL 3.5 performs the ML-DSA-87 cryptographic operation. This avoids claiming that Vault OSS Transit performs ML-DSA-87 when it does not.

The workflow uses the protected `kms-live-smoke` environment and requires the `LOCAL_OPENSSL_SIGNER_URL` environment secret in addition to `VAULT_ADDR`.

## Out of Scope (Task 4+)

- GitHub OIDC → Vault production signing in CI
- Manifest auto-sign on release tag
- Hybrid auth → `deploy.ts` integration
- PR-tier `--require-pqc` promotion

---

## References

- `scripts/lib/pqc-signature.mjs` — provenance verify path
- `scripts/lib/hybrid-auth-envelope.mjs` — operator auth verify path
- `scripts/lib/public-key-registry.mjs` — public key SSoT
