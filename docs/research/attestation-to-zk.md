# AegisProof v2 — Attestation to ZK Research Pipeline

**Status:** RESEARCH-ONLY design — **NOT production verified**  
**Scope:** TEE evidence → claims → Groth16 (conceptual integration)

---

## 1. Pipeline Overview

```
TEE Evidence (quote / report)
        ↓
AttestationPipeline
        ↓
ClaimsGate (valid result + OFFLINE_FIXTURE minimum)
        ↓
ZkClaimsMapper → ZK-oriented claims
        ↓
[Groth16 prover — Frozen Core, unchanged]
        ↓
snarkjs / on-chain verify
        ↓
[Optional outer layers]
Artifact provenance (SHA-256)
        ↓
PQC metadata signature (ML-DSA-87)
```

**Critical:** TEE layer provides **research context** for claims — it does not replace Groth16 soundness proof.

---

## 2. Integration Points (Research)

| Step | Module | Frozen Core impact |
|------|--------|-------------------|
| Evidence ingest | `tee/providers/*` | None |
| Verify attestation | `tee/verification/*` | None |
| Normalize | mock/real normalizers | None |
| Gate claims | `claims-gate.ts` | None |
| Map to ZK claims | `zk-claims-mapper.ts` | None |
| Generate proof | `packages/sdk/` proveCanonical | **Frozen — not modified** |
| Verify proof | T1–T9 path | **Frozen — not modified** |

---

## 3. Trust Flow (Honest)

| Stage | Trust source | Verified |
|-------|--------------|----------|
| TEE evidence | Fixture / mock / offline ECDSA | FIXTURE only |
| Claims | ClaimsGate policy | TESTED |
| Groth16 proof | Trusted setup + circuit | TESTED (T1–T9) |
| Provenance | SHA-256 pins | TESTED |
| PQC | ML-DSA-87 (when signed) | TESTED (mock KMS) |

**No stage combines to "hardware-rooted Groth16" — such claims are forbidden.**

---

## 4. Research Demo (Phase F)

Fixture-based demo script: `scripts/demo-research-pipeline.mjs`

Labels all stages:
- TEE: FIXTURE / OFFLINE
- KMS: MOCKED
- OIDC: MOCKED
- PRODUCTION: NOT VERIFIED

---

## 5. Future Research (Not Authorized)

- Online PCCS/KDS integration
- Remote verifier service
- HARDWARE_ROOTED VerificationLevel
- TEE witness generation inside enclave for production

See [phase9-roadmap.md](./phase9-roadmap.md) — planning only.

---

## References

- [tee/integration/zk-tee-model.md](../../tee/integration/zk-tee-model.md)
- [tee/integration/zk-evidence-integration-design.md](../../tee/integration/zk-evidence-integration-design.md)
- [tee-attestation.md](./tee-attestation.md)
- [attestation-flow-design.md](../../tee/integration/attestation-flow-design.md)
