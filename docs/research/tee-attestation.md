# AegisProof v2 — TEE Attestation Research

**Status:** RESEARCH-ONLY (ADR-001)
**Scope:** Intel TDX, AMD SEV-SNP, attestation adapter layer
**Production TEE:** NOT VERIFIED · NOT CONNECTED
**Live DCAP/PCCS/KDS:** NOT VERIFIED

---

## 0. Boundary summary

| Concept | Status |
|---------|--------|
| ADR-001 isolation boundary | **Frozen** — TEE must not semantically merge into protocol v2 |
| TEE implementation (`tee/`) | Research / PoC — may evolve additively within ADR-001 |
| Current verification scope | Offline / mock / fixture only |
| Production TEE deployment | **NOT VERIFIED** |
| TEE claims as crypto guarantees | **Forbidden** — Groth16 remains proof of record |

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

## 4. Security Boundaries (Frozen semantics)

- **SB-01:** Mock and real normalizers MUST NOT merge
- **SB-02:** Claims MUST pass ClaimsGate
- **SB-03:** VerificationLevel is sole trust type
- **SB-04:** AttestationPipeline compose-only
- **SB-05:** ClaimsGate / pipeline MUST NOT alter Groth16, `publicSignals(30)`, or on-chain verifier/shield semantics

Changes to **frozen TEE boundary semantics** (SB-01–SB-05) require Architecture Review. Research documentation and additive adapter work within ADR-001 does not change protocol v2 semantics.

---

## 5. Live infrastructure (NOT VERIFIED)

| Path | Status |
|------|--------|
| DCAP offline fixture | IMPLEMENTED / TESTED / FIXTURE |
| VCEK offline fixture | IMPLEMENTED / TESTED / FIXTURE |
| DCAP online / PCCS | **NOT VERIFIED** |
| AMD KDS online | **NOT VERIFIED** |
| Production TEE hardware | **NOT VERIFIED** |

See [dcap-vcek.md](./dcap-vcek.md) for scope separation.

---

## 6. Explicit Non-Claims

This research layer does **not**:
- Replace Groth16 verification
- Connect to production TEE hardware in CI
- Provide hardware-rooted trust for mainnet deployment
- Modify circuits, zkey, or public signal layout semantics
- Represent fixture/mock PASS as live production attestation

---

## References

- [tee/README.md](../../tee/README.md)
- [ADR-001](../adr/001-architecture-hardening-freeze.md)
- [dcap-vcek.md](./dcap-vcek.md)
- [attestation-to-zk.md](./attestation-to-zk.md)
