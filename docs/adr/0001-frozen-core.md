# ADR-0001: Frozen Groth16 Core

## Status

Accepted

## Date

2026-08-08

## Context

AegisProof v2 relies on a pinned Groth16 trusted setup, verifier contract, and public signal layout. External reviewers and OSS contributors must not modify the ZK proof path without explicit architecture review. Phase 8.10–8.13 established hash-pinned production artifacts and T1–T9 regression gates.

## Decision

The following **cryptographic / protocol semantics and security boundaries** are frozen unless an explicit Architecture Review approves change:

> **Clarification:** *Frozen* does **not** mean “these directories are never edited.” It means the **meaning** of the proof system, public signal layout, verifier behavior, and TEE isolation boundary cannot change without review. Operational code, CI, provenance tooling, and research adapters may evolve **additively** as long as they do not alter frozen semantics.

- Canonical compiled circuit artifacts and R1CS references
- `production.zkey` hash pin (`ce5a3d30…6571`)
- Verification key hash pin (`d012bd29…d2ec`)
- Trusted setup / ceremony evidence (hash pins are SSoT)
- `Groth16VerifierV2Production.sol` and production verifier path semantics
- `protocol/contracts/` (frozen protocol layer semantics)
- `packages/sdk/` public API and **`proveCanonical()`** return semantics
- **`publicSignals` layout (30 signals**, canonical order)
- **ADR-001 TEE isolation boundary** (no semantic merge into protocol v2)

Additive outer layers (provenance, PQC, hybrid auth, CI security, TEE research adapters) may evolve without modifying frozen Groth16/protocol semantics.

## Consequences

- **Positive:** Reproducible verification for auditors; clear PR boundary.
- **Positive:** T1–T9 regression remains the integrity contract.
- **Negative:** Circuit or VK changes require formal review and ceremony re-run.
- **Risk:** Migration debt (`production.zkey` in git) is tracked separately; hash pin is the source of truth.

## References

- [docs/perf/prover-regression-contract.md](../perf/prover-regression-contract.md)
- [ADR-001: Architecture Hardening Freeze](./001-architecture-hardening-freeze.md) (TEE scope)
