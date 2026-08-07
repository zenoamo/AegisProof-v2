# ML-DSA Artifact Provenance Signing (Phase 8.14)

**Status:** Prototype + CI verification  
**Phase:** 8.14  
**Prerequisite:** Phase 8.13 PQC wrapper (placeholder envelope)  

---

## Purpose

Extend Phase 8.13 artifact provenance from SHA-256 integrity plus PQC placeholder to ML-DSA-65 signatures for authenticity.

This phase does not post-quantize Groth16. The frozen ZK core (circuits, R1CS, production.zkey, VK, verifier contract, publicSignals layout, `proveCanonical()`) remains unchanged.

```
Artifact file
  ↓ SHA-256 (integrity)
Manifest entry
  ↓ ML-DSA-65 (authenticity)
verifyManifest() / verify:provenance
```

---

## ML-DSA Adoption Rationale

| Concern | Approach |
|---------|----------|
| NIST IR 8547 (2035 classical sunset) | PQC on **outer** provenance layer first |
| Supply-chain tampering | SHA-256 detects change; ML-DSA proves publisher |
| Groth16 compatibility | Zero changes to proof generation/verification |
| Algorithm choice | **ML-DSA-65** (FIPS 204, NIST Level 3) — balance of size vs security |

Library: `@noble/post-quantum` (auditable, pure JS, scripts-layer only).

---

## Key Lifecycle

| Tier | Source | Repository |
|------|--------|------------|
| **Development** | `npm run generate:pqc-dev-keys` → `artifacts/provenance/keys/*.key.json` | Private: **gitignored** |
| **Development verify** | `artifacts/provenance/public-keys/*.json` | Public: **committable** |
| **CI (PR)** | No key → unsigned manifest, WARN | No secrets required |
| **CI (schedule/manual)** | Ephemeral `ci-ephemeral` keypair on runner | Injected via `AEGIS_PQC_PRIVATE_KEY_PATH` |
| **Production** | External KMS/HSM (design only) | **Forbidden in 8.14** |

Environment variables:

- `AEGIS_PQC_PRIVATE_KEY_HEX` — hex-encoded ML-DSA secret key
- `AEGIS_PQC_PRIVATE_KEY_PATH` — path to `.key.json` (gitignored)
- `AEGIS_PQC_PUBLIC_KEY_HEX` + `AEGIS_PQC_PUBLIC_KEY_ID` — CI verify override

---

## Manifest Schema (schemaVersion 2)

**Path:** `artifacts/provenance/manifest.json`

Top-level changes from 8.13:

- `schemaVersion: 2`
- `phase: "8.14"`
- `pqcPolicy.algorithm` / `pqcPolicy.version`

Per-entry `pqcSignatureEnvelope`:

```json
{
  "status": "signed",
  "algorithm": "ML-DSA-65",
  "version": "v1",
  "signature": "<hex>",
  "publicKeyId": "dev-test-1",
  "signedAt": "2026-08-07T..."
}
```

Unsigned (no key at generation):

```json
{
  "status": "unsigned",
  "algorithm": "ML-DSA-65",
  "version": "v1",
  "signature": null,
  "publicKeyId": null,
  "signedAt": null
}
```

Legacy 8.13 `status: "placeholder"` entries produce WARN during migration.

---

## Signature Domain Separation

Signing message bytes:

```
AEGIS_ARTIFACT_PROVENANCE_V1\n{canonical-json-payload}
```

Canonical payload (per entry):

```json
{
  "domain": "AEGIS_ARTIFACT_PROVENANCE_V1",
  "artifact": "production.zkey",
  "path": "crypto-artifacts/phase4/production.zkey",
  "sha256": "...",
  "size": 2881473,
  "version": "v2",
  "source": "crypto-artifacts"
}
```

JSON keys are sorted recursively (`canonicalJson()`). The envelope fields are **excluded** from the signed payload to prevent circular dependency.

---

## API (scripts/lib/pqc-signature.mjs)

```javascript
createPqcSignature(payload, privateKey, { publicKeyId })
verifyPqcSignature(payload, signatureEnvelope, publicKey)
```

---

## Verification CLI

```bash
# Default: SHA-256 required, ML-DSA optional (WARN if unsigned)
npm run verify:provenance -- --live

# Strict: ML-DSA required for core artifacts (fail-closed)
npm run verify:provenance -- --live --require-pqc
```

Failure modes (all fail-closed with `--require-pqc`):

- Signature missing
- Invalid signature
- Public key not found / mismatch
- Algorithm or version mismatch
- Manifest hash tampering (SHA-256 layer)

---

## CI Rollout Plan

| Trigger | SHA-256 | ML-DSA |
|---------|---------|--------|
| PR / push (`prover-compatibility`) | **required** | optional (WARN) |
| Schedule / manual (`prover-benchmark`) | **required** | **required** (`--require-pqc`) |
| Phase 8.15 (planned) | required | required on PR after review |

Steps added in 8.14:

- `npm run test:pqc-signature` on every PR
- Ephemeral key + `--require-pqc` on scheduled benchmark job

---

## Threat Model

| Threat | Mitigation (8.14) |
|--------|-------------------|
| Artifact file tampering | SHA-256 manifest vs live file |
| Manifest entry tampering | ML-DSA over canonical entry payload |
| Wrong publisher | Public key registry by `publicKeyId` |
| Algorithm downgrade | Envelope `algorithm` + `version` checked |
| Groth16 quantum break | **Out of scope** — monitor (Phase 9) |

Residual risks:

- Dev/CI keys are not production HSM-backed (8.14 prototype)
- Unsigned manifests on PR until 8.15 enforcement

---

## Migration Path

1. **8.13 → 8.14:** Regenerate manifest (`npm run generate:provenance`); placeholder → unsigned/signed
2. **8.14:** Optional PQC on PR; required on schedule
3. **8.15:** PR `--require-pqc` after review; production KMS integration design

---

## Performance

Benchmark: `npm run bench:provenance`  
Output: `benchmarks/reports/provenance-verify-benchmark.json`

Measures SHA-256-only vs SHA-256 + ML-DSA verify p50 latency.  
Prover benchmarks M1–M5 are **unaffected**.

---

## Frozen Boundaries (unchanged)

- `circuits/`, R1CS, `production.zkey`, VK, `Groth16VerifierV2Production.sol`
- `protocol/contracts/`, `packages/sdk/`, `tee/`
- publicSignals 30 layout, `proveCanonical()` semantics
- T1–T9 regression contract
- Pinned production hashes

---

## Related Files

| File | Role |
|------|------|
| `scripts/lib/pqc-signature.mjs` | ML-DSA sign/verify |
| `scripts/lib/artifact-provenance.mjs` | Manifest integration |
| `scripts/verify-provenance-manifest.mjs` | CLI |
| `tests/pqc-signature.test.mjs` | T-PQC-01..05 |
| `docs/research/phase8.14-architecture-note.md` | Pre-implementation review |
