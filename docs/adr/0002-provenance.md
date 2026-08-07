# ADR-0002: Artifact Provenance Layer

## Status

Accepted

## Date

2026-08-08

## Context

Supply-chain integrity requires verifying that committed artifacts match expected hashes. Phase 8.13 introduced a manifest schema with SHA-256 per entry and pinned production hashes.

## Decision

1. **SSoT manifest:** `artifacts/provenance/manifest.json` (schemaVersion 1, phase 8.13).
2. **Verification order:** manifest integrity → live SHA-256 → optional PQC signature.
3. **CLI:** `npm run verify:provenance -- --live` required on PR CI.
4. **Module:** `scripts/lib/artifact-provenance.mjs` is the canonical implementation.

Provenance verifies **artifact files**, not Groth16 proof validity.

## Consequences

- **Positive:** Tampered binaries detected before prover runs.
- **Positive:** Manifest is committable audit evidence.
- **Negative:** Manifest must be regenerated when artifact paths change.
- **Neutral:** PQC signatures are optional on PR tier (WARN); strict on schedule.

## References

- [artifact-policy.md](../security/artifact-policy.md)
- [phase8.13-architecture-summary.md](../research/phase8.13-architecture-summary.md)
