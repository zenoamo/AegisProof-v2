# Proof Generation Workflow Example

**Purpose:** Demonstrates reproducible proof generation from canonical witness input.

## Usage

```bash
cd examples/proof-generation-workflow
node generate.js
```

## What This Does

1. Loads canonical test vector (`artifacts/phase2/tests/input_v2.json`)
2. Generates witness using `aegis_commit_core_v2_js/witness_calculator.js`
3. Proves using production zkey (`artifacts/phase4/final/production.zkey`)
4. Saves result to `artifacts/phase4/reports/workflow_proof.json`

See full script in `generate.js`.

## Requirements

- Node.js 22+
- All Phase 4 artifacts present
- Canonical wasm file from Phase 2 intact

## Notes

This example performs proving (no secrets committed). Run on trusted hardware only.
