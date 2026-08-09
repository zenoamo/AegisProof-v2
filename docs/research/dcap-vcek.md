# AegisProof v2 — DCAP / VCEK Research

**Status:** RESEARCH / FIXTURE — offline PoC only
**Prerequisite:** [phase8.9b-offline-dcap-vcek-plan.md](./phase8.9b-offline-dcap-vcek-plan.md)

---

## 1. Scope Separation

| Path | Status | Network |
|------|--------|---------|
| **DCAP offline** | IMPLEMENTED / TESTED / FIXTURE | None |
| **VCEK offline** | IMPLEMENTED / TESTED / FIXTURE | None |
| **PCCS online** | NOT IMPLEMENTED | Would require Intel PCCS |
| **AMD KDS online** | NOT IMPLEMENTED | Would require AMD KDS |
| **Production attestation** | NOT VERIFIED | Hardware + collateral services |

---

## 2. Feature Flag

```
TEE_VERIFICATION unset (default)
    → TdxDcapVerifierStub / SevVcekVerifierStub
    → Stage D (unchanged default path)

TEE_VERIFICATION=offline
    → TdxDcapOfflineVerifier / SevVcekOfflineVerifier
    → Static fixture + Node.js crypto ECDSA
    → Stage F
```

Default path **must not change** without new ADR.

---

## 3. Implementation Map

| Component | Location |
|-----------|----------|
| Verification factory | `tee/verification/verification-factory.ts` |
| TDX offline verifier | `tee/verification/tdx-dcap-offline-verifier.ts` |
| SEV offline verifier | `tee/verification/sev-vcek-offline-verifier.ts` |
| Collateral loader | `tee/verification/offline-collateral-loader.ts` |
| Fixtures | `tee/verification/fixtures/` — **RESEARCH_FIXTURE_ONLY** |
| Tests | `tee/tests/offline-verification.test.ts` |

---

## 4. Crypto Boundary

### Allowed (offline PoC)

- Node.js `crypto` ECDSA (P-256 TDX, P-384 SEV)
- Synthetic certificate chains in fixtures
- Positive / negative test vectors

### Forbidden (explicitly out of scope)

- PCCS connection
- KDS connection
- HTTPS collateral fetch
- Production quote validation at scale

---

## 5. Honest Status Labels

When reporting DCAP/VCEK results:

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| OFFLINE FIXTURE PASS | PRODUCTION VERIFIED |
| RESEARCH PoC | HARDWARE ROOTED |
| Stage F evaluation | Live attestation confirmed |
| NOT VERIFIED (online) | PCCS integration complete |

---

## References

- [phase8.9b-offline-dcap-vcek-plan.md](./phase8.9b-offline-dcap-vcek-plan.md)
- [intel-tdx/dcap-verification-design.md](../../tee/intel-tdx/dcap-verification-design.md)
- [amd-sev-snp/vcek-verification-design.md](../../tee/amd-sev-snp/vcek-verification-design.md)
