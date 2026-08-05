# Phase 8.9B — Offline DCAP/VCEK Verification PoC

> **Research PoC Only** · **Not Production Implementation** · **RESEARCH_FIXTURE_ONLY**

**Phase**: 8.9B  
**Status**: Offline Crypto Verification Research PoC  
**Prerequisite**: Phase 8.9A Remote Attestation Design complete

---

## 1. Purpose

Add an **offline cryptographic verification PoC** above Phase 8.8 verification stubs. Uses static fixtures and Node.js `crypto` — no PCCS, no KDS, no network.

**Goals**:

- Establish DCAP/VCEK verification boundary research implementation
- Static fixture-based verification flow
- Production Migration Gate G2/G3 evaluation material

**Not Goals**:

- Production attestation verification
- Online collateral retrieval (PCCS / KDS)
- Remote Verifier service
- Normalizer / Claims Mapper integration
- protocol / circuit changes

---

## 2. Feature Flag

```
TEE_VERIFICATION unset (default)
        ↓
TdxDcapVerifierStub / SevVcekVerifierStub
        ↓
Stage D (unchanged)

TEE_VERIFICATION=offline
        ↓
TdxDcapOfflineVerifier / SevVcekOfflineVerifier
        ↓
Static fixture + Node crypto ECDSA
        ↓
Stage F
```

Default path **must not change**.

---

## 3. Implementation Scope

| Component | Location | Role |
|-----------|----------|------|
| Verification factory | `tee/verification/verification-factory.ts` | `TEE_VERIFICATION` selection |
| Collateral loader | `tee/verification/offline-collateral-loader.ts` | Filesystem fixture load only |
| TDX offline verifier | `tee/verification/tdx-dcap-offline-verifier.ts` | P-256 ECDSA + cert chain |
| SEV offline verifier | `tee/verification/sev-vcek-offline-verifier.ts` | P-384 ECDSA + cert chain |
| Fixtures | `tee/verification/fixtures/` | Research-only test vectors |
| Tests | `tee/tests/offline-verification.test.ts` | positive / negative / factory |
| Evaluation Stage F | `tee/scripts/evaluate.ts` | offline verification PoC |

---

## 4. Crypto Boundary

### Allowed

- Node.js `crypto` API
- Offline ECDSA verification (P-256 TDX, P-384 SEV)
- Local fixture certificate chains (synthetic research certs)
- Positive / negative test vectors

### Forbidden

- PCCS connection
- KDS connection
- HTTPS fetch / network collateral retrieval
- Production certificate acquisition
- Production key management
- External Intel DCAP npm libraries (deferred)

---

## 5. Fixture Policy

All fixtures under `tee/verification/fixtures/` are **research-only**:

- `RESEARCH_FIXTURE_ONLY: true` in JSON metadata
- README documents origin (synthetic, generated for PoC)
- **Not production credentials**
- Not Intel/AMD live collateral

---

## 6. pocScope

| Verifier | pocScope |
|----------|----------|
| Stub (default) | `verification-stub` |
| Offline PoC | `offline-verification-poc` |

Offline verification **does not** upgrade evidence to `verified` or connect to Normalizer / Claims Mapper.

---

## 7. Security Boundary

Changes limited to:

- `tee/verification/` (extension)
- `tee/tests/offline-verification.test.ts` (new)
- `tee/scripts/evaluate.ts` (Stage F only)
- `docs/research/`, design docs, `tee/README.md` (minimal)

**Unchanged**: `protocol/`, `circuits/`, `crypto-artifacts/`, `formal/`, mock path, stubs, acquisition, providers, parsers, normalizer, claims mapper.

---

## 8. Production Migration Gates (Post 8.9B)

| Gate | After 8.9B |
|------|------------|
| G2 Offline DCAP/VCEK PoC | **Partial met** (fixture-based offline PoC) |
| G3 Real crypto verification | **Partial met** (augments stubs; default still stub) |
| PCCS/KDS online | Not met (intentionally out of scope) |
| G4 Remote Verifier | Not met (Phase 8.9C) |

---

## 9. Future Phases

| Phase | Focus |
|-------|-------|
| 8.9B+ | Online PCCS/KDS collateral (stop condition) |
| 8.9C | Remote Verifier PoC |
| 8.10 | ZK Integration (protocol review) |

---

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: Offline verifier trusts only bundled research fixtures, not live Intel/AMD infrastructure.
*   **Assumption**: Synthetic cert chains demonstrate verification flow; they are not production roots of trust.
*   **Limitation**: `offline-verification-poc` cannot be used as production attestation gate.
*   **Security Consideration**: Network fetch is explicitly prohibited in collateral loader.
*   **Future Implementation Scope**: Online collateral (PCCS/KDS) requires separate stop-condition approval.

---

**Offline Crypto Verification Research PoC — Not Production Remote Attestation Verification**
