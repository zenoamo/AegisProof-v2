# AegisProof v2 — TEE Attestation Research

**Status:** RESEARCH-ONLY (ADR-001)
**Scope:** Intel TDX, AMD SEV-SNP, attestation adapter layer
**Production TEE:** NOT VERIFIED · NOT CONNECTED

---

## 1. Architecture

```
Provider (mock / experimental guest reader)
    → Verifier (stub / offline fixture)
    → Normalizer (mock OR real — SB-01 split)
    → ClaimsGate (requires valid TeeVerificationResult)
    → ZkClaimsMapper
    → AttestationPipeline (compose-only orchestrator)
```

ADR-001: Pipeline is orchestrator only — no embedded verification logic.

---

## 2. Verification Levels

| Level | Meaning | Production use |
|-------|---------|----------------|
| `NONE` | N/A | — |
| `STRUCTURE_ONLY` | Parser check (stub) | Research |
| `OFFLINE_FIXTURE` | Offline ECDSA PoC (8.9B) | Research |
| `OFFLINE_VERIFIED` | Reserved | Not implemented |
| `HARDWARE_ROOTED` | Reserved | **NOT VERIFIED** |

---

## 3. Component Status

| Component | Implemented | Tested | Mode |
|-----------|:-----------:|:------:|------|
| TDX provider | ✅ | ✅ | MOCK / experimental |
| SEV-SNP provider | ✅ | ✅ | MOCK / experimental |
| AttestationPipeline | ✅ | ✅ | FIXTURE |
| ClaimsGate | ✅ | ✅ | — |
| ZkClaimsMapper | ✅ | ✅ | FIXTURE |
| Mock normalizer | ✅ | ✅ | MOCK only |
| Real normalizer | ✅ | ✅ | Real evidence only |
| Stage A–G evaluation | ✅ | ✅ | CI (`f00a514` era) |

---

## 4. Security Boundaries (Frozen)

- **SB-01:** Mock and real normalizers MUST NOT merge
- **SB-02:** Claims MUST pass ClaimsGate
- **SB-03:** VerificationLevel is sole trust type
- **SB-04:** AttestationPipeline compose-only

Changes to `tee/` require Architecture Review per ADR-0001 but research expansion does not modify `tee/` code in this execution.

---

## 5. Explicit Non-Claims

This research layer does **not**:
- Replace Groth16 verification
- Connect to production TEE hardware in CI
- Provide hardware-rooted trust for mainnet deployment
- Modify circuits, zkey, or public signals

---

## References

- [tee/README.md](../../tee/README.md)
- [ADR-001](../adr/001-architecture-hardening-freeze.md)
- [dcap-vcek.md](./dcap-vcek.md)
- [attestation-to-zk.md](./attestation-to-zk.md)
