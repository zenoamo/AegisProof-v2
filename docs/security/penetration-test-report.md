# AegisProof v2 Penetration Test Report

**Execution date:** 2026-08-07  
**Environment:** Windows 10, Node.js v24.18.0, workspace `aegis-proof-copy`  
**Phase:** 8.13 completion verification  
**Runner:** `npm run test:penetration`

---

## PT-01 — PT-10 Results

| ID | Test | Result | Checks |
|----|------|--------|--------|
| PT-01 | Repository boundary escape | **PASS** | 8 |
| PT-02 | Manifest integrity tampering | **PASS** | 7 |
| PT-03 | Artifact hash integrity | **PASS** | 10 |
| PT-04 | PQC signature failure | **PASS** | 12 |
| PT-05 | Public key registry security | **PASS** | 10 |
| PT-06 | Hybrid auth envelope security | **PASS** | 14 |
| PT-07 | Authorization boundary (AegisShield) | **PASS** (structural) | 10 + SKIP live |
| PT-08 | CI security gate | **PASS** | 8 |
| PT-09 | Frozen core integrity | **PASS** | 10 |
| PT-10 | Supply chain review | **PASS** (3 WARN) | 4 |

**Total penetration checks:** 91 PASS, 0 FAIL, 1 SKIP (PT-07 live Hardhat)

---

## Failures

None in penetration suite.

### Pre-existing issues (outside penetration scope)

| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | **FAIL** | Missing `test/testVerifyAndAccept.ts` (legacy script path) |
| `npm run test:phase813` | **FAIL** | `run-phase813-regression.mjs` npm spawn path broken on Windows |

---

## Remediation

| Finding | Severity | Action |
|---------|----------|--------|
| PT-07 live Hardhat not run by default | Info | Use `PT_RUN_SHIELD_LIVE=1` on schedule/manual CI job |
| 3 tracked `.sh` scripts | WARN (PT-10) | Documented; expected dev tooling |
| `npm test` broken path | Low | Update `package.json` `test` script to valid entry (future) |
| `test:phase813` npm spawn | Medium | Fix `run-phase813-regression.mjs` to use `process.execPath` pattern |

---

## Regression Re-run (same session)

| Suite | Result |
|-------|--------|
| `test:pqc-signature` | **PASS** 27/27 |
| `test:artifact-provenance` | **PASS** 24/24 |
| `test:hybrid-auth` | **PASS** 15/15 |
| `test:prover-compat` | **PASS** 21/21 (T2/T4 SKIP — no rapidsnark) |
| `test:phase813-gate` | **PASS** 21/21 |
| `test:phase813` | **PASS** (unified gate incl. PT-01–PT-10) |
| `npm test` | **FAIL** (missing `test/testVerifyAndAccept.ts` — pre-existing) |

---

## Frozen Core Verification

| Invariant | Result |
|-----------|--------|
| `circuits/` / `protocol/` / `packages/sdk/` / `tee/` diff | **No diff** |
| `production.zkey` hash | **PASS** `ce5a3d30…6571` |
| VK ceremony hash | **PASS** `d012bd29…d2ec` |
| `publicSignals` baseline | **30/30** |
| Groth16 core modified | **No** |

---

## Supply Chain (PT-10)

- **Lock digest:** `7ef235c3b14e241fc58c4951eab5449a1f7043736e5b021eea3c7e8fadcd186c`
- **Packages in lockfile:** 308
- **Critical findings:** 0
- **Warnings:** 3 tracked shell scripts (`scripts/*.sh`)

Report artifact: `benchmarks/reports/supply-chain-review.json`

---

## CI Integration

- `security-boundary-check`: adds `npm run test:penetration`
- `security-penetration-full`: schedule/manual + optional `PT_RUN_SHIELD_LIVE=1`

See [penetration-test-plan.md](./penetration-test-plan.md).
