# ADR-0001: Frozen Groth16 Core

## Status

Accepted

## Date

2026-08-08

## Context

AegisProof v2 relies on a pinned Groth16 trusted setup, verifier contract, and public signal layout. External reviewers and OSS contributors must not modify the ZK proof path without explicit architecture review. Phase 8.10–8.13 established hash-pinned production artifacts and T1–T9 regression gates.

## Decision

The following are **permanently frozen** unless an explicit Architecture Review approves change:

- `circuits/` sources and compiled artifact references
- R1CS, `production.zkey` hash pin (`ce5a3d30…6571`)
- Verification key hash pin (`d012bd29…d2ec`)
- `Groth16VerifierV2Production.sol` and production verifier path
- `protocol/contracts/` (frozen protocol layer)
- `packages/sdk/` public API and `proveCanonical()` semantics
- `publicSignals` layout (30 signals)
- `tee/` (ADR-001 isolated research layer)

Additive outer layers (provenance, PQC, hybrid auth, CI security) may evolve without modifying the frozen core.

## Consequences

- **Positive:** Reproducible verification for auditors; clear PR boundary.
- **Positive:** T1–T9 regression remains the integrity contract.
- **Negative:** Circuit or VK changes require formal review and ceremony re-run.
- **Risk:** Migration debt (`production.zkey` in git) is tracked separately; hash pin is the source of truth.

## References

- [docs/perf/prover-regression-contract.md](../perf/prover-regression-contract.md)
- [ADR-001: Architecture Hardening Freeze](./001-architecture-hardening-freeze.md) (TEE scope)
