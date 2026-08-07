# KMS Signer Design — Phase 8.14 Task 2

**Version:** 1.0  
**Date:** 2026-08-08  
**Module:** `scripts/lib/kms-signer.mjs`  
**Prerequisite:** [kms-hsm-architecture.md](./kms-hsm-architecture.md)

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

### 2. `vault-transit` (stub)

- No network calls to Vault
- Requires `keyId` in committed public key registry
- Returns deterministic `vault-stub-<digest>` signature for testing adapter wiring
- Production Task 3+ will replace stub with OIDC-authenticated Vault client

### 3. `cloud-hsm` (interface only)

- `CloudHsmAdapter` export defines interface
- `createSigner()` validates config against registry
- `signPayload()` throws `NOT_IMPLEMENTED`

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
  backend: "mock-hsm" | "vault-transit" | "cloud-hsm",
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

Run: `npm run test:kms-signer`

---

## CI Integration

`security-boundary-check` job runs `npm run test:kms-signer` after penetration tests.

---

## Out of Scope (Task 2)

- Live Vault / Cloud HSM connections
- OIDC workflow wiring
- Manifest signing automation (Task 3+)
- Private key generation for production keyIds
- Groth16 / protocol / SDK changes

---

## References

- `scripts/lib/pqc-signature.mjs` — provenance verify path
- `scripts/lib/hybrid-auth-envelope.mjs` — operator auth verify path
- `scripts/lib/public-key-registry.mjs` — public key SSoT
