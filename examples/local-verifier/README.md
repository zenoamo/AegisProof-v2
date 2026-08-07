# Local Verifier Example

Demonstrates offline proof verification using the production verification key, with no network access.

## Usage

```bash
cd examples/local-verifier
node verify.js
```

## Requirements

- `artifacts/phase4/final/production-vkey.json` — from the Phase 4 ceremony
- `artifacts/phase4/reports/production_proof_baseline.json` — from `scripts/phase4_verify_production.mjs`

If either file is missing:

```bash
node scripts/phase4_verify_production.mjs
```

## What it does

1. Loads the production VK from disk
2. Verifies IC count equals 31 (Groth16)
3. Loads the baseline proof artifact
4. Runs off-chain Groth16 verification with snarkjs
5. Prints public signal values (read-only inspection)

## What it does not do

- No network calls (fully offline)
- No deployments
- No secret key exposure
- No state modifications

This is a read-and-verify operation only.
