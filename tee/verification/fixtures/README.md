# TEE Verification Fixtures

> **RESEARCH_FIXTURE_ONLY** · **Not Production Credentials**

Synthetic test vectors for Phase 8.9B offline DCAP/VCEK verification PoC.

## Origin

- Generated locally by `generate-fixtures.mjs` using Node.js `crypto`
- **Not** Intel DCAP production collateral or AMD KDS VCEK
- **Not** for production attestation

## Regeneration

```bash
node tee/verification/fixtures/generate-fixtures.mjs
```

## Network Policy

Fixtures are loaded from filesystem only. No PCCS, KDS, or HTTPS fetch.
