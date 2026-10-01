# AegisProof RISC Zero zkVM PoC

This directory contains an isolated research proof-of-concept for adding a
zkVM execution layer to AegisProof v2.

## What this proves

The guest deterministically computes:

`output = input^2 + 7`

The host supplies the private input, generates a RISC Zero receipt, verifies
that receipt against the guest Image ID, and checks the public journal output.

This is intentionally a small integration boundary, not a replacement for
the existing Groth16 Frozen Core.

## Boundary

- Existing Groth16 protocol, contracts, SDK semantics, and 30-signal layout are unchanged.
- The zkVM PoC lives under `zkvm/risc0-poc/`.
- Generated guest ELFs, receipts, and build output are not committed.
- No production prover path depends on this PoC yet.
- The next research step is to define a stable AegisProof statement/commitment
  interface before attempting proof wrapping, recursion, or aggregation.

## Local prerequisites

Install the RISC Zero toolchain using the upstream `rzup` tooling, then run:

```bash
cd zkvm/risc0-poc
cargo run --release
```

The expected result is a message confirming that the zkVM receipt was verified.

## Security status

RESEARCH / PoC ONLY. This adapter is not a production security boundary and
does not replace the existing AegisProof verification path.
