# Proof Generation Workflow Example

Demonstrates reproducible proof generation from a canonical witness input.

## Usage

```bash
cd examples/proof-generation-workflow
node generate.js
```

## What it does

1. Loads the canonical test vector (`artifacts/phase2/tests/input_v2.json`)
2. Generates a witness with `aegis_commit_core_v2_js/witness_calculator.js`
3. Proves using the production zkey (`artifacts/phase4/final/production.zkey`)
4. Writes the result to `artifacts/phase4/reports/workflow_proof.json`

See `generate.js` for the full script.

## Requirements

- Node.js 22+
- Phase 4 artifacts present
- Phase 2 canonical WASM intact

## Notes

This example performs proving only; no secrets are committed. Run on trusted hardware.
