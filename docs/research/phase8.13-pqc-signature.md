# PQC Artifact Signature (Phase 8.13)

**Status:** Complete (prototype + CI optional/strict modes)  
**Phase:** 8.13 Task 4  
**Prerequisite:** Phase 8.13 Tasks 1–3 (provenance boundary + placeholder envelope)  

---

## Purpose

Activate ML-DSA-87 signatures on the artifact provenance layer from Phase 8.13 Tasks 1–3.

This is not Groth16 post-quantization. The ZK core remains frozen; PQC protects artifact metadata authenticity only.

```
SHA-256 (integrity, required)  +  ML-DSA-87 (authenticity, additive)
```

---

## Security Review

### 1. PQC layer does NOT intrude on ZK verification path

| Path | Touched? |
|------|----------|
| `proveCanonical()` | No |
| Groth16 proof generation | No |
| On-chain `Groth16VerifierV2Production` | No |
| publicSignals layout (30) | No |
| `scripts/lib/pqc-signature.mjs` | Yes — **isolated adapter** |

PQC code runs only in provenance CLI/tests (`verify:provenance`, `generate:provenance`).

### 2. Artifact provenance only

Signatures cover per-entry canonical payload:

```json
{
  "domain": "AEGIS_ARTIFACT_PROVENANCE_V1",
  "artifact": "production.zkey",
  "path": "...",
  "sha256": "...",
  "size": N,
  "version": "v2",
  "source": "..."
}
```

Domain separation: `AEGIS_ARTIFACT_PROVENANCE_V1\n` + sorted-key canonical JSON.

### 3. Groth16 proof compatibility maintained

- T1–T9 regression unchanged
- production.zkey / VK pinned hashes unchanged
- Prover benchmark M1–M5 unaffected

### 4. Rollback-capable additive design

- SHA-256 verification path **unchanged** (always runs first)
- PQC envelope is optional metadata (`status: "unsigned"` when no key)
- Legacy `status: "placeholder"` entries WARN only
- Removing PQC layer = revert scripts only; ZK artifacts unchanged

---

## ML-DSA Adapter (Task 4-A)

**Module:** `scripts/lib/pqc-signature.mjs`  
**Library:** `@noble/post-quantum` (`ml_dsa87`, FIPS 204)  
**Algorithm:** ML-DSA-87 / version v1  

### API

```javascript
createPqcSignatureEnvelope(payload, options)
// -> { status, algorithmVersion, version, signature, publicKey, signedAt }

verifyPqcSignatureEnvelope(manifest, options)
// -> { valid, algorithm, verifiedAt, verifiedCount, errors, warnings }
```

Low-level helpers (`verifyEnvelope`, `entrySignPayload`) are internal to the adapter.

---

## Manifest Extension (Task 4-B)

**Schema maintained:** `schemaVersion: 1`, `phase: "8.13"`

### Before (Tasks 1–3)

```json
"pqcSignatureEnvelope": {
  "status": "placeholder",
  "algorithmVersion": "ML-DSA-87",
  "signature": null
}
```

### After (Task 4)

```json
"pqcSignatureEnvelope": {
  "status": "signed",
  "algorithmVersion": "ML-DSA-87",
  "version": "v1",
  "signature": "<hex>",
  "publicKey": "<hex>",
  "signedAt": "<ISO>"
}
```

### Verification rules

| Condition | Default mode | `--pqc` strict |
|-----------|-------------|----------------|
| SHA-256 mismatch | **FAIL** | **FAIL** |
| PQC signature invalid | **FAIL** (if signed) | **FAIL** |
| PQC signature missing | WARN | **FAIL** (core artifacts) |
| Legacy placeholder | WARN | WARN |

---

## CI Integration (Task 4-C)

```bash
# Default (PR): SHA-256 required, PQC optional
npm run verify:provenance -- --live

# Strict (schedule/manual): SHA-256 + PQC required
npm run verify:provenance -- --live --pqc
```

Phase 8.13 rollout: **WARN / optional on PR**; strict mode on scheduled benchmark job only.

---

## Key Lifecycle

| Environment | Policy |
|-------------|--------|
| Development | `npm run generate:pqc-dev-keys` → gitignored private key |
| CI PR | No key → unsigned, WARN |
| CI schedule | Ephemeral `ci-ephemeral` key on runner |
| Production | KMS/HSM — **not in Task 4** |

---

## CLI Reference

```bash
npm run generate:pqc-dev-keys          # dev keypair (gitignored private)
npm run generate:provenance              # manifest + sign if key present
npm run verify:provenance -- --live      # hash verify (PQC optional)
npm run verify:provenance -- --pqc       # hash + PQC required
npm run test:artifact-provenance
npm run test:pqc-signature
```

---

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Artifact file tampering | SHA-256 live vs manifest |
| Manifest publisher spoofing | ML-DSA-87 per-entry signature |
| Algorithm downgrade | `algorithmVersion` + `version` check |
| ZK soundness break (BN254) | Out of scope — monitor Phase 9 |

---

## Migration Path

| Phase | Action |
|-------|--------|
| 8.13 Task 1–3 | Placeholder envelope |
| **8.13 Task 4** | ML-DSA-87 sign/verify activated |
| 8.14+ | Optional PR strict gate review |
| 9 | Protocol-level PQ if ZK primitive migration needed |

---

## Related

- `docs/research/phase8.13-pqc-wrapper.md` — overall 8.13 design
- `scripts/lib/artifact-provenance.mjs` — manifest integration
- `artifacts/provenance/manifest.json` — SSoT
