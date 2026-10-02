# Ceremony Artifact Verification Guide

**Purpose:** How to independently verify Phase 4 production ceremony artifacts.  
**Scope:** Per-step hashes, beacon validation, and IC cross-checks.

---

## Per-Step Hash Verification

All artifacts are stored under `artifacts/phase4/`. Run:

```bash
npm run test:artifact-provenance
```

This should complete the current artifact-provenance regression checks and include:

- `phase4:ptauHash` == `4afdd19bbf8cceeb...`
- `phase4:zkeyHash` == `ce5a3d308868f2fe...`
- `phase4:vkeyHash` == `d012bd29ff6e4c44...`
- All transcript records present
- No dev artifact hashes mixed in

If any mismatch occurs, STOP and investigate immediately.

---

## Beacon Validation

The beacon used is the Bitcoin genesis block hash:

```text
000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
```

Recorded in `artifacts/phase4/beacon/beacon-record.json`. The record includes:

- `source`: "Bitcoin genesis block hash (public, immutable)"
- `beaconHash`: exact 256-bit value
- `iterationsExp`: 10 (2^10 iterations per snarkjs spec)
- `appliedTo`: chains for PoT and Groth16 zkey with their output hashes

You can independently verify this hash against any blockchain explorer or reference:
https://blockchain.info/block/000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f

---

## IC Cross-Check Against VKey

Verify that the embedded IC constants in the production verifier contract match the vkey:

```bash
node scripts/phase4_verify_production.mjs
```

Expected output includes:

```
PASS contract IC constants == production vkey IC (31/31)
```

This confirms all 31 IC points (including vk_alpha_1) are correctly embedded.

---

## Contribution Chain Reproducibility Note

Due to disclosure, the three contribution slots were executed in a single environment. The chain is structurally valid and verified, but independent human contributions are recommended before mainnet-grade deployments. Extending the chain (any additional `zkey contribute`) remains valid and will produce a new VK.

---

## What to Do If Hash Mismatch

1. **Do not promote** any artifact from an aborted run.
2. Remove `artifacts/phase4/` and restart the ceremony if a partial run left artifacts.
3. Re-run the full ceremony script (`scripts/phase4_ceremony.mjs`) and verify all steps complete.
4. Report any unexpected behavior to maintainers with full logs.
