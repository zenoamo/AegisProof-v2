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

Rotation evidence validation: `validateKeyRotationEvidence()` and `validateKeyRotationChain()`.

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

## 4. Auditable Rotation Evidence

Rotation transitions use versioned evidence records with:

- `rotationId` — unique transition identifier.
- `predecessorKeyId` / `successorKeyId` — explicit registry linkage.
- `effectiveAt` — canonical ISO-8601 transition time.
- `reason` — mandatory operator/audit rationale.
- `recordedAt` — optional evidence-record timestamp.

Validation fails closed for self-rotation, unknown keys, algorithm/version mismatch, malformed timestamps, successors that are not active at `effectiveAt`, and predecessors revoked before `effectiveAt`. Chains additionally reject duplicate rotation IDs/links and non-monotonic transition times.

Rotation evidence is policy metadata; it does not alter the ML-DSA-87 primitive or the Frozen Groth16/BN254 proof path.

Rotation PASS and manifest signature verification are separate assertions. A valid rotation record does not mean the manifest was signed by the successor key. Manifest verification requires the entry signature, `algorithmVersion: ML-DSA-87`, and `publicKeyId` bound to the registered public key.

The production private key is not in this repository. `aegis-provenance-prod-v1` has no committed public key, so the live provisioning state is `UNPROVISIONED`: `PRODUCTION SIGNING KEY NOT PROVISIONED` and `production provenance: NOT VERIFIED`. That status means the credential is absent. It does not mean the verifier implementation failed.

A later operator-supplied public key becomes `PROVISIONED` only when its `publicKeyId` is `aegis-provenance-prod-v1`, the algorithm is ML-DSA-87, and the key is active. The CI key `aegis-ci-mldsa87-v1` is not a production identity. A revoked or malformed record is `INVALID`. Production signing uses the external signer declared for that id and does not read a local private key. `production provenance: VERIFIED` still requires the manifest signature to verify against that registered key. Rotation PASS does not supply that signature.

Test signers use `test-` key ids. A test signature is not production identity. After rotation, an old or revoked key does not remain production VERIFIED; only a signature bound to the current active production id can reach that state.

## 5. Revocation Semantics

| Event | Effect on verification |
|-------|------------------------|
| Remove key from registry | `--require-pqc` FAIL for envelopes referencing keyId |
| Vault key disabled | Live sign FAIL at release |
| Compromised dev key | Regenerate; no production impact if not in registry |

**Historical manifests:** Verification uses registry at verify time — archived manifests may require retained public keys.

---

## 6. Failure Semantics (Code)

| Error | Meaning |
|-------|---------|
| Unknown keyId | Registry miss → fail-closed on strict path |
| Algorithm mismatch | Envelope/registry inconsistency |
| KMS envelope metadata conflict | `KMS_ENVELOPE_METADATA_CONFLICT` |

Remediation `9562d22` semantics preserved — do not weaken.

---

## 7. Research Gaps

- No automated rotation test against live Vault
- No committed prod registry entry (`PRODUCTION SIGNING KEY NOT PROVISIONED`)
- Test-key signature PASS is not production provenance VERIFIED
- PR-tier does not enforce rotation policy

---

## References

- [kms-key-rotation-runbook.md](../security/kms-key-rotation-runbook.md)
- [vault-github-oidc.md](../security/vault-github-oidc.md)
- [pqc-readiness.md](./pqc-readiness.md)
