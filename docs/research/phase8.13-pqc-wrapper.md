# PQC Wrapper Hardening (Phase 8.13)

**Status:** Task 4 complete — ML-DSA-87 signature activation  
**Phase:** 8.13  
**Prerequisite:** Phase 8.12 Quantum Readiness Architecture Review  

---

## Purpose

Establish an outer-layer cryptographic boundary for quantum readiness without modifying the frozen Groth16 ZK core (Phase 8.10–8.11 invariants).

Phase 8.13 is not a Groth16 post-quantization phase. It adds:

1. **Artifact provenance** — SHA-256 + ML-DSA-87 signature envelope (Task 4 activated)
2. **Hybrid authentication** — ECDSA + future PQC signature research wrapper

---

## Threat Model (Additive Layer)

| Threat | Layer | Phase 8.13 Mitigation |
|--------|-------|------------------------|
| Artifact tampering (supply chain) | Provenance | SHA-256 manifest + ML-DSA-87 sig |
| Operator key compromise (future PQ) | Hybrid auth | Envelope schema for dual signatures |
| BN254 / Groth16 quantum break | ZK core | **Out of scope** — monitor only (Phase 9) |

Classical Groth16 soundness assumptions **unchanged**.

---

## Additive Architecture

```
User
  ↓
[Hybrid Auth Envelope]          ← scripts/lib/hybrid-auth-envelope.mjs (8.13)
  ↓
Protocol (FROZEN)
  ↓
proveCanonical() → Groth16 (FROZEN)
  ↓
Verifier (FROZEN)

Parallel:
resolveArtifacts() → [Provenance Manifest] → verifyManifest()  (8.13)
```

---

## Manifest Schema (schemaVersion 1)

**Path:** `artifacts/provenance/manifest.json`

```json
{
  "schemaVersion": 1,
  "phase": "8.13",
  "generatedAt": "ISO-8601",
  "commit": "git-sha",
  "pinnedProductionHashes": {
    "zkeyHash": "ce5a3d30…",
    "vkHash": "d012bd29…"
  },
  "entries": [
    {
      "artifact": "production.zkey",
      "path": "crypto-artifacts/phase4/production.zkey",
      "sha256": "...",
      "size": 2881473,
      "createdAt": "ISO-8601",
      "source": "crypto-artifacts",
      "version": "v2",
      "classicalHash": { "algorithm": "SHA-256", "digest": "..." },
      "pqcSignatureEnvelope": {
        "status": "signed",
        "algorithmVersion": "ML-DSA-87",
        "version": "v1",
        "signature": "<hex>",
        "publicKey": "<hex>",
        "signedAt": "ISO-8601"
      }
    }
  ],
  "pqcPolicy": {
    "classicalRequired": true,
    "pqcSignatureRequired": false,
    "allowedPqcAlgorithms": ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]
  }
}
```

### Covered Artifacts

| Artifact | Required |
|----------|----------|
| production.zkey | Yes |
| production-vkey.json | Yes |
| aegis_commit_core_v2.wasm | Yes |
| aegis_commit_core_v2.r1cs | Yes |
| rapidsnark-prover binary | Optional |
| baseline.json / rapidsnark-evaluation.json | Optional |

---

## Hybrid Auth Envelope Schema

**Module:** `scripts/lib/hybrid-auth-envelope.mjs`

```json
{
  "schemaVersion": 1,
  "algorithmVersion": "hybrid-v1-placeholder",
  "payload": { "domain": "AEGIS_DEPLOYMENT_AUTH_V1", "operator": "0x…", "action": "deploy-verifier" },
  "classicalSignature": "hex-or-null",
  "pqSignature": "hex-or-null",
  "classicalAlgorithm": "ECDSA-secp256k1",
  "pqAlgorithm": "ML-DSA-87"
}
```

Phase 8.13: schema + verify API only; no production PQC library integration.

---

## API

| Function | Module | Purpose |
|----------|--------|---------|
| `createManifest(paths)` | `artifact-provenance.mjs` | Build manifest from resolver |
| `verifyManifest(manifest)` | `artifact-provenance.mjs` | SHA-256 + pin + optional PQC |
| `verifyLiveArtifacts()` | `artifact-provenance.mjs` | CI one-shot check |
| `createPqcSignatureEnvelope()` | `pqc-signature.mjs` | ML-DSA-87 sign entry payload |
| `verifyPqcSignatureEnvelope()` | `pqc-signature.mjs` | ML-DSA-87 verify manifest |
| `createHybridEnvelope()` | `hybrid-auth-envelope.mjs` | Research wrapper |
| `verifyHybridEnvelope()` | `hybrid-auth-envelope.mjs` | Classical optional; PQC deferred |

### CLI

```bash
npm run generate:provenance
npm run verify:provenance -- --live
npm run verify:provenance -- --pqc    # strict: PQC required
npm run test:artifact-provenance
npm run test:pqc-signature
```

---

## CI Flow

```
resolveArtifacts()
        ↓
verify:provenance --live
        ↓
verify SHA-256 + pinned zkey/VK
        ↓
(PQC signature: optional — WARN if unsigned; --pqc strict in schedule)
        ↓
test:prover-compat (T1–T9 unchanged)
test:pqc-signature (T-PQC-01..05)
```

**Fail conditions:** hash mismatch, missing required artifact, unexpected missing entry.

---

## Migration Strategy

| Phase | Action |
|-------|--------|
| **8.13 Task 1–3** | Manifest schema + placeholder PQC envelope |
| **8.13 Task 4** | ML-DSA-87 sign/verify activated (scripts only) |
| **8.14+** | Optional PR strict gate (`--pqc` required) after review |
| **9** | Parallel protocol version if ZK primitive migration needed |

Existing proofs and verifiers **remain valid** throughout.

---

## Frozen Boundary Confirmation

**Unchanged in Phase 8.13:**

- circuits / R1CS / production.zkey / VK
- Groth16VerifierV2Production.sol
- publicSignals layout (30)
- proveCanonical() semantics
- protocol/ / packages/sdk/ / tee/
- T1–T9 regression contract

**Changed (allowed):**

- scripts/lib/artifact-provenance.mjs
- scripts/lib/hybrid-auth-envelope.mjs
- artifacts/provenance/manifest.json (metadata only)
- CI provenance steps
- scripts/lib/pqc-signature.mjs (Task 4)

---

## References

- Phase 8.12 Quantum Readiness Architecture Review
- `docs/perf/prover-regression-contract.md`
- `scripts/lib/resolve-artifacts.mjs`
- NIST FIPS 204 (ML-DSA)
- `docs/research/phase8.13-pqc-signature.md`
