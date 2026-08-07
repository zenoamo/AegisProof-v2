# ADR-0003: PQC Outer Layer (ML-DSA-87)

## Status

Accepted

## Date

2026-08-08

## Context

NIST post-quantum standards (FIPS 204) motivate authenticating artifact provenance metadata. Groth16 proofs remain classical; PQC applies only to outer governance layers.

## Decision

1. **Algorithm:** ML-DSA-87 via `@noble/post-quantum` in `scripts/` only.
2. **Domain separation:** `AEGIS_ARTIFACT_PROVENANCE_V1\n` + canonical JSON payload.
3. **Public keys:** Committed in `artifacts/provenance/public-keys/`.
4. **Private keys:** Never committed; Vault/HSM in production (Phase 8.14+).
5. **Verification modes:**
   - Default: SHA-256 required; PQC WARN if unsigned.
   - Strict (`--pqc`, `--require-pqc`): PQC required.

PQC does **not** replace Groth16 verification, modify `publicSignals`, or alter the verifier contract.

## Consequences

- **Positive:** Quantum-ready authenticity for supply-chain metadata.
- **Positive:** Fail-closed strict tier for scheduled CI.
- **Negative:** PR tier allows unsigned manifests during review period.
- **Risk:** Production KMS signing not yet wired (Phase 8.14 Task 3+).

## References

- [kms-hsm-architecture.md](../security/kms-hsm-architecture.md)
- [kms-signer-design.md](../security/kms-signer-design.md)
- ADR [0002-provenance.md](./0002-provenance.md)
