# Phase 8.14 Architecture Note

**Date:** 2026-08-07  
**Prerequisite:** Phase 8.13 PQC wrapper (placeholder envelope)  
**Scope:** Artifact provenance ML-DSA signing only — Groth16 core frozen  

---

## 1. Current State (Phase 8.13)

| Component | Role |
|-----------|------|
| `scripts/lib/artifact-provenance.mjs` | Manifest create/verify, SHA-256 per entry, PQC placeholder |
| `scripts/generate-provenance-manifest.mjs` | CLI: resolve → create → write |
| `scripts/verify-provenance-manifest.mjs` | CLI: `--live` or file verify |
| `artifacts/provenance/manifest.json` | SSoT manifest (schemaVersion 1 → 2 in 8.14) |
| CI `prover-compatibility` | `verify:provenance --live` + `test:artifact-provenance` after T1–T9 |

### Manifest schema (8.13)

- Top-level: `schemaVersion`, `phase`, `generatedAt`, `commit`, `pinnedProductionHashes`, `entries[]`
- Per entry: `artifact`, `path`, `sha256`, `classicalHash`, `pqcSignatureEnvelope`
- Envelope (8.13): `status: "placeholder"`, null `signature`

### Hash verification flow

1. `resolveArtifacts()` → absolute paths
2. `createManifest()` → SHA-256 per file + pinned hash cross-check
3. `verifyManifest()` → live file hash vs manifest; production.zkey/vkey vs constants
4. Fail-closed on hash mismatch or missing required artifacts

### CI failure boundary

- T1–T9 (`test:prover-compat`) **must PASS** — hard gate
- `verify:provenance --live` **must PASS** — hash verification hard gate
- PQC (8.13): **optional** — WARN on placeholder only

---

## 2. Phase 8.14 Design Decisions

### Goal

Establish **SHA-256 integrity + ML-DSA authenticity** for artifact provenance.  
**Not** Groth16 post-quantization.

### Signature layer

- New module: `scripts/lib/pqc-signature.mjs`
- Algorithm: **ML-DSA-65** (FIPS 204, `@noble/post-quantum`)
- Domain separation: `AEGIS_ARTIFACT_PROVENANCE_V1\n` + canonical JSON payload

### Signed payload (per entry)

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

Envelope after signing:

```json
{
  "status": "signed",
  "algorithm": "ML-DSA-65",
  "version": "v1",
  "signature": "<hex>",
  "publicKeyId": "dev-test-1",
  "signedAt": "<ISO>"
}
```

### Key lifecycle (8.14)

| Environment | Key source | Repo policy |
|-------------|-----------|-------------|
| Development | `artifacts/provenance/keys/dev-test-1.key.json` (gitignored) | Private key **never** committed |
| CI (optional PR) | No key → unsigned manifest, WARN | — |
| CI (scheduled/manual) | Ephemeral key via workflow env | Secret injection only |
| Production | KMS/HSM design documented | **No production key in 8.14** |

Public keys: `artifacts/provenance/public-keys/{id}.json` — **may** be committed.

### Verification modes

| Mode | SHA-256 | ML-DSA |
|------|---------|--------|
| Default | required | optional (WARN if unsigned) |
| `--require-pqc` | required | required (FAIL if missing/invalid) |

### CI rollout

- **8.14 PR path:** hash required, PQC optional/warn
- **8.14 schedule/manual:** `--require-pqc` with ephemeral CI key
- **8.15:** promote PQC to required on PR (review period)

---

## 3. Unchanged Boundaries

- circuits/, R1CS, production.zkey, VK, Groth16VerifierV2Production.sol
- protocol/contracts/, packages/sdk/, tee/
- publicSignals 30 layout, proveCanonical() semantics
- T1–T9 regression contract
- Pinned production hashes

---

## 4. Files to Change

| File | Change |
|------|--------|
| `scripts/lib/pqc-signature.mjs` | **NEW** — sign/verify API |
| `scripts/lib/artifact-provenance.mjs` | Sign integration, verify PQC |
| `scripts/verify-provenance-manifest.mjs` | `--require-pqc` flag |
| `scripts/generate-provenance-manifest.mjs` | Sign when key available |
| `tests/pqc-signature.test.mjs` | T-PQC-01..05 |
| `.github/workflows/aegis_repro_ci.yml` | Schedule PQC required job |
| `docs/research/phase8.14-mldsa-provenance.md` | Full design doc |
