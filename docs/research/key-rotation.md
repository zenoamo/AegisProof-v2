# AegisProof v2 — Key Rotation & Revocation (Research)

**Status:** Research documentation (Phase C)
**Operational runbook:** [kms-key-rotation-runbook.md](../security/kms-key-rotation-runbook.md)
**Live rotation:** NOT VERIFIED

---

## 1. Key Types

| Key type | Storage | Rotation surface |
|----------|---------|------------------|
| ML-DSA provenance (dev) | `artifacts/provenance/keys/` (gitignored) | Manual regen |
| ML-DSA provenance (CI) | Ephemeral runner | Per job |
| ML-DSA provenance (prod) | Vault Transit `aegis-provenance-prod-v1` | Operator runbook |
| Hybrid auth keys | Research/dev only | Manual |
| Groth16 trusted setup | Ceremony chain | Independent contributions (major event) |

**Groth16 VK rotation requires new ceremony — out of routine key rotation scope.**

---

## 2. Public Key Registry

**SSoT:** `artifacts/provenance/public-keys/{keyId}.json`

| keyId | Status |
|-------|--------|
| `aegis-ci-mldsa87-v1` | ✅ committed |
| `aegis-provenance-prod-v1` | ❌ not committed (required before live release) |

Registry validation: `public-key-registry.mjs` → `validateRegistryRecord()`

---

## 3. Rotation Procedure (Design)

Per runbook (operator — NOT VERIFIED live):

1. Provision new Transit key version in Vault
2. Update registry JSON with new public key + keyId/version
3. Dual-sign transition period (old + new keys in registry)
4. Update `AEGIS_PROVENANCE_KEY_ID` in release environment
5. Re-tag release; verify strict provenance PASS
6. Revoke old Vault key version after grace period

---

## 4. Revocation Semantics

| Event | Effect on verification |
|-------|------------------------|
| Remove key from registry | `--require-pqc` FAIL for envelopes referencing keyId |
| Vault key disabled | Live sign FAIL at release |
| Compromised dev key | Regenerate; no production impact if not in registry |

**Historical manifests:** Verification uses registry at verify time — archived manifests may require retained public keys.

---

## 5. Failure Semantics (Code)

| Error | Meaning |
|-------|---------|
| Unknown keyId | Registry miss → fail-closed on strict path |
| Algorithm mismatch | Envelope/registry inconsistency |
| KMS envelope metadata conflict | `KMS_ENVELOPE_METADATA_CONFLICT` |

Remediation `9562d22` semantics preserved — do not weaken.

---

## 6. Research Gaps

- No automated rotation test against live Vault
- No committed prod registry entry
- PR-tier does not enforce rotation policy

---

## References

- [kms-key-rotation-runbook.md](../security/kms-key-rotation-runbook.md)
- [vault-github-oidc.md](../security/vault-github-oidc.md)
- [pqc-readiness.md](./pqc-readiness.md)
