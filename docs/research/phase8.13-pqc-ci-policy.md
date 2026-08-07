# PQC Provenance CI Policy (Phase 8.13)

**Status:** Complete  
**Phase:** 8.13 Task 5  
**Prerequisite:** Phase 8.13 Task 4 (ML-DSA-87 signature activation)  

---

## Purpose

Harden the artifact provenance PQC layer into a CI trust boundary without modifying the frozen Groth16 ZK core.

---

## PQC Trust Boundary

```
┌─────────────────────────────────────────────────────────┐
│  OUTER LAYER (Phase 8.13 — additive, rollback-safe)     │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Public Key Registry (committed)                   │  │
│  │ artifacts/provenance/public-keys/*.json           │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ML-DSA-87 Sign/Verify Adapter                     │  │
│  │ scripts/lib/pqc-signature.mjs                     │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Provenance Manifest                               │  │
│  │ SHA-256 + pqcSignatureEnvelope                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↕ (no intrusion)
┌─────────────────────────────────────────────────────────┐
│  FROZEN ZK CORE                                         │
│  proveCanonical() → Groth16 → Groth16VerifierV2         │
└─────────────────────────────────────────────────────────┘
```

PQC protects **artifact metadata authenticity** only. It does not verify Groth16 proofs.

---

## Verification Order (mandatory)

1. **Manifest integrity** — schema, pinned hashes, classicalHash consistency
2. **Artifact hash** — live SHA-256 vs manifest + production pin constants
3. **PQC signature** — ML-DSA-87 over canonical entry payload

SHA-256 mismatch always fails before PQC is evaluated.

---

## CI Enforcement Levels

| Tier | Trigger | Command | SHA-256 | ML-DSA |
|------|---------|---------|---------|--------|
| **Default** | PR / push | `verify:provenance --live` | **required** | optional (WARN) |
| **Strict** | schedule / manual | `verify:provenance --live --pqc` | **required** | **required** |
| **Production sim** | manual + secret | `verify:provenance --live --require-pqc` | **required** | **required** (registry key) |

### Default (PR / Push)

- Missing PQC private key does **not** fail the job
- Unsigned manifest entries emit WARN
- T1–T9 prover regression runs unchanged after provenance check

### Strict (Schedule / Manual)

- Job: `provenance-pqc-hardening`
- Ephemeral CI keypair generated on runner (never committed)
- Unsigned / invalid signatures fail closed

### Production Simulation

- Uses GitHub secret `AEGIS_PQC_PRIVATE_KEY_HEX` (optional)
- Public verifier key: `aegis-ci-mldsa87-v1` (committed registry)
- `--require-pqc` alias maintained for production path drills

---

## Key Lifecycle

| Material | Location | Repository |
|----------|----------|------------|
| Public key registry | `artifacts/provenance/public-keys/{keyId}.json` | **Committed** |
| Private key (dev) | `artifacts/provenance/keys/*.key.json` | **gitignore** |
| CI ephemeral private | Runner temp only | Never stored |
| Production private | KMS / GitHub secret | Never in repo |

### Registry schema

```json
{
  "keyId": "aegis-ci-mldsa87-v1",
  "algorithm": "ML-DSA-87",
  "version": "v1",
  "publicKey": "<hex>",
  "immutable": true
}
```

CI verifies signatures **without** private key when envelope embeds `publicKey` or references committed `keyId`.

---

## Signing Workflow

```
artifact file
  ↓ sha256File()
manifest entry (classicalHash)
  ↓ entrySignPayload() + domain separation
ML-DSA-87 sign (private key — env/gitignored only)
  ↓
pqcSignatureEnvelope { status:"signed", signature, publicKey, publicKeyId }
  ↓
manifest.json
```

---

## Rollback Strategy

1. Remove/disable `provenance-pqc-hardening` CI job → SHA-256-only path remains
2. Delete PQC envelope fields from manifest → hash verification still works
3. No changes to zkey/VK/circuit/verifier required for rollback

---

## Frozen Boundary Confirmation

**Unchanged:**

- circuits/, R1CS, production.zkey, VK
- Groth16VerifierV2Production.sol
- publicSignals layout (30)
- proveCanonical() semantics
- protocol/contracts/, packages/sdk/, tee/
- T1–T9 regression contract

**Changed (allowed):**

- scripts/lib/pqc-signature.mjs
- scripts/lib/public-key-registry.mjs
- scripts/lib/artifact-provenance.mjs
- artifacts/provenance/public-keys/
- CI workflows, tests, docs

---

## Regression Tests

| ID | Case |
|----|------|
| T-PQC-01 | Valid signature accept |
| T-PQC-02 | Modified manifest reject |
| T-PQC-03 | Wrong public key reject |
| T-PQC-04 | Missing signature reject (`--pqc`) |
| T-PQC-05 | Algorithm/version mismatch reject |
| T-PQC-06 | Unknown publicKeyId reject |
| T-PQC-07 | Wrong algorithmVersion reject |
| T-PQC-08 | Signature replay reject |
| T-PQC-09 | Canonical payload mutation reject |
| T-PQC-10 | Expired/invalid metadata reject |

---

## Related

- `docs/research/phase8.13-pqc-signature.md` — Task 4 design
- `docs/perf/provenance-verification.md` — latency benchmark
- `benchmarks/reports/provenance-verify-benchmark.json` — SSoT metrics
