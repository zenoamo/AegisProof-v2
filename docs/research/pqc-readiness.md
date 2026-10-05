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
| PR-tier strict | PARTIAL (WARN-only) | Phase 8.15 pending |
| Key lifecycle policy | IMPLEMENTED | status + validity window + purpose policy |
| Key rotation evidence | IMPLEMENTED | predecessor/successor evidence + chain validation |

---

## 3. Verification Modes

| Mode | Flag | SHA-256 | ML-DSA |
|------|------|---------|--------|
| Default | `--live` | required | WARN if unsigned |
| Strict | `--pqc` / `--require-pqc` | required | required FAIL |

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
## 6. Production Readiness Gaps

1. `aegis-provenance-prod-v1` registry key not committed
2. Live Vault Transit signing NOT VERIFIED
3. PR path allows unsigned manifests (WARN)
4. Hybrid auth not wired to deployment scripts

---

## 7. Non-Goals

- Replacing Groth16 with lattice-based SNARKs in v2
- PQC-protecting ZK proof soundness
- Committing private keys to repository

---

## References

- [ADR-0003](../adr/0003-pqc-layer.md)
- [phase8.13-pqc-signature.md](./phase8.13-pqc-signature.md)
- [hybrid-authentication.md](./hybrid-authentication.md)
- [key-rotation.md](./key-rotation.md)
