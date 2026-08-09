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

## 5. Production Readiness Gaps

1. `aegis-provenance-prod-v1` registry key not committed
2. Live Vault Transit signing NOT VERIFIED
3. PR path allows unsigned manifests (WARN)
4. Hybrid auth not wired to deployment scripts

---

## 6. Non-Goals

- Replacing Groth16 with lattice-based SNARKs in v2
- PQC-protecting ZK proof soundness
- Committing private keys to repository

---

## References

- [ADR-0003](../adr/0003-pqc-layer.md)
- [phase8.13-pqc-signature.md](./phase8.13-pqc-signature.md)
- [hybrid-authentication.md](./hybrid-authentication.md)
- [key-rotation.md](./key-rotation.md)
