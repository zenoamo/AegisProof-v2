# AegisProof v2 — Research Pipeline Demo

**Status:** RESEARCH_DEMO_ONLY — **NOT production verified**

---

## Purpose

End-to-end demonstration of the research architecture layers:

```
TEE fixture evidence
    → AttestationPipeline / offline verification
    → Groth16 T1–T9 regression
    → Provenance SHA-256 verify
    → PQC (WARN if unsigned)
```

All stages use **fixture / mock / local** semantics. No live Vault, OIDC, HSM, PCCS, or production TEE.

---

## Run

```bash
node scripts/demo-research-pipeline.mjs
```

Expected banner:

```text
TEE:        FIXTURE / OFFLINE
KMS:        MOCKED
OIDC:       MOCKED
HSM:        NOT CONNECTED
PCCS:       NOT CONNECTED
PRODUCTION: NOT VERIFIED

RESEARCH_DEMO_ONLY
```

---

## What This Demo Does NOT Claim

- ❌ LIVE PRODUCTION VERIFIED
- ❌ Hardware-rooted attestation
- ❌ Live KMS/OIDC signing
- ❌ Mainnet deployment readiness

---

## Frozen Core

This demo **reads** Frozen Core artifacts for Groth16 regression. It does **not** modify:

- `circuits/`, `protocol/`, `packages/sdk/`, `verifier/`, `tee/`

---

## References

- [attestation-to-zk.md](../../docs/research/attestation-to-zk.md)
- [implementation-status-matrix.md](../../docs/research/implementation-status-matrix.md)
- [scripts/demo-research-pipeline.mjs](../../scripts/demo-research-pipeline.mjs)
