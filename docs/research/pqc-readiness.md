# AegisProof v2 — PQC Readiness (Research)

**Status:** Research documentation (Phase C)
**Algorithm:** ML-DSA-87 (FIPS 204) via `@noble/post-quantum`
**Critical rule:** **PQC does NOT replace Groth16 verification**

---

## 1. Layer Model

```
┌─────────────────────────────────────────┐
│  OUTER: ML-DSA-87 metadata signing      │  ← this document
│  (provenance manifest, hybrid auth)     │
├─────────────────────────────────────────┤
│  FROZEN: Groth16 BN128 proof system     │  ← unchanged
└─────────────────────────────────────────┘
```

ADR-0003: PQC applies to artifact metadata authenticity only.

---

## 2. Implementation Status

| Component | Status | Evidence |
|-----------|--------|----------|
| ML-DSA-87 adapter | IMPLEMENTED | `scripts/lib/pqc-signature.mjs` |
| Domain separation | IMPLEMENTED | `AEGIS_ARTIFACT_PROVENANCE_V1\n` |
| Public key registry | IMPLEMENTED | `artifacts/provenance/public-keys/` |
| Dev key generation | IMPLEMENTED | `generate:pqc-dev-keys` (gitignored keys) |
| KMS signing path | IMPLEMENTED / MOCKED | `kms-provenance.mjs` |
| Live KMS signing | NOT VERIFIED | operator checklist |
| External signer binding | IMPLEMENTED | `scripts/lib/external-provenance-signer.mjs` |
| Production provisioning boundary | IMPLEMENTED | `UNPROVISIONED` / `PROVISIONED` / `INVALID` |
| Production key `aegis-provenance-prod-v1` | UNPROVISIONED | public key not in registry; private key not in repo |
| PR-tier strict | NOT VERIFIED on unsigned manifest | `--pqc` exits 2; not a WARN success |
| Key lifecycle policy | IMPLEMENTED | status + validity window + purpose policy |
| Key rotation evidence | IMPLEMENTED | predecessor/successor evidence + chain validation |

---

## 3. Verification Modes

| Mode | Flag | SHA-256 | ML-DSA |
|------|------|---------|--------|
| Default | `--live` | required | WARN if unsigned |
| Strict | `--pqc` / `--require-pqc` | required | unsigned exit 2; invalid exit 1; verifier unavailable exit 3 |

CI tiers: [phase8.13-pqc-ci-policy.md](./phase8.13-pqc-ci-policy.md)

---

## 4. Quantum Threat Scope

| Threat | v2 response |
|--------|-------------|
| Groth16/BN128 broken by quantum computer | **Not mitigated** — monitor PQ-ZK research |
| Artifact metadata forgery | ML-DSA-87 signatures (when enabled) |
| Hybrid operator auth forgery | Hybrid envelope (research layer) |

---

## 5. PQC Key Lifecycle Policy

Registry records now support an explicit lifecycle state and validity window without changing the cryptographic algorithm or frozen proof path:

- `active` — accepted by strict verification.
- `deprecated` — retained for historical verification, rejected when `requireActiveKey` is enabled.
- `revoked` — rejected by strict verification.
- `notBefore` / `notAfter` — optional ISO-8601 validity window.
- `revokedAt` — explicit revocation timestamp.
- `purposes` — optional allowed-use labels for policy separation.

Strict consumers can enable `requireActiveKey` and an optional `keyPurpose`. This prevents a valid ML-DSA signature from being accepted merely because its cryptographic bytes verify; the referenced registry key must also be authorized for the current lifecycle policy.

The default compatibility path remains unchanged so existing signed artifacts can be verified during migration.

Rotation evidence is validated as policy metadata: strict validation requires an explicit predecessor/successor relationship, effective timestamp, reason, successor validity at the transition time, and no premature predecessor revocation. Rotation chains additionally enforce unique IDs/links and monotonic transition times.

---
## 6. Production Provenance Binding

ML-DSA-87 authenticates provenance metadata. It does not sign a Groth16 proof and it does not make the proof quantum-resistant.

The private key is not in this repository, not in fixtures, and not in workflow YAML. Signer identity is `publicKeyId` bound to a registered public key. A signature alone does not name the signer.

Rotation evidence and manifest signature verification are different assertions. Rotation PASS does not make a manifest `PROVENANCE VERIFIED`.

`production provenance: VERIFIED` requires provisioning state `PROVISIONED`, a valid ML-DSA-87 signature, and `publicKeyId` binding to `aegis-provenance-prod-v1`. These are separate from a Groth16 proof signature and from ZK quantum resistance.

Provisioning states:

- `UNPROVISIONED` — production public key is absent. This is `PRODUCTION SIGNING KEY NOT PROVISIONED` and `production provenance: NOT VERIFIED`. It records incomplete credential provisioning, not an implementation failure.
- `PROVISIONED` — the production public key exists, its id is `aegis-provenance-prod-v1`, the algorithm is ML-DSA-87, and the lifecycle status is active. Signing still requires an external production signer. The signer must return that same `publicKeyId`.
- `INVALID` — malformed key, algorithm mismatch, identity mismatch, CI-key reuse, or a revoked key. Verification fails closed and does not select another key.

A test signer (`test-` key id) can make the manifest signature `PROVENANCE VERIFIED`. That result stays `production provenance: NOT VERIFIED`. Rotation evidence PASS is still a separate assertion from either signature.

## 7. Production Readiness Gaps

1. `aegis-provenance-prod-v1` registry key not committed — `PRODUCTION SIGNING KEY NOT PROVISIONED`
2. Live Vault Transit signing NOT VERIFIED
3. Production-like `--pqc` on the unsigned committed manifest is `PROVENANCE NOT VERIFIED` (exit 2), not a WARN success
4. Hybrid auth not wired to deployment scripts
5. Test-key verification PASS is not production provenance VERIFIED

---

## 8. Non-Goals

- Replacing Groth16 with lattice-based SNARKs in v2
- PQC-protecting ZK proof soundness
- Committing private keys to repository

---

## References

- [ADR-0003](../adr/0003-pqc-layer.md)
- [phase8.13-pqc-signature.md](./phase8.13-pqc-signature.md)
- [hybrid-authentication.md](./hybrid-authentication.md)
- [key-rotation.md](./key-rotation.md)
