# AegisProof v2 Penetration Test Plan

**Phase:** 8.13 completion verification  
**Scope:** Repository governance layer only — `scripts/`, `tests/`, `docs/`, CI  
**Frozen (out of scope for modification):** Groth16 core, `circuits/`, `protocol/`, `packages/sdk/`, `tee/`, verifier contract, `production.zkey`, VK, `proveCanonical()`, `publicSignals(30)`

---

## Threat Model

| Actor | Goal | Mitigation layer |
|-------|------|------------------|
| Malicious contributor | Commit secrets (`.env`, `.pem`, private keys) | PT-01 repository boundary |
| Artifact tamperer | Alter manifest or artifact hashes undetected | PT-02, PT-03 provenance |
| Signature forger | Bypass ML-DSA-87 provenance | PT-04 PQC verification |
| Registry attacker | Inject private keys or duplicate keyIds | PT-05 public key registry |
| Deployment attacker | Forge hybrid auth envelope | PT-06 hybrid auth |
| Protocol attacker | Replay proofs, spoof sessions | PT-07 AegisShield penetration |
| CI bypasser | Merge without security gates | PT-08 CI integration |
| Supply-chain attacker | Malicious npm lifecycle scripts | PT-10 supply chain review |

Trust boundaries:

1. **GitHub public repo** — source, tests, manifest, public keys only  
2. **CI runner** — ephemeral verification; no production secrets  
3. **Frozen Groth16 core** — hash-pinned; never modified in Phase 8.13+  
4. **External secure storage** — `production.zkey`, private signing keys (target state)

---

## Test Cases

| ID | Name | File | Expected |
|----|------|------|----------|
| PT-01 | Repository boundary escape | `penetration-boundary.test.mjs` | CRITICAL → FAIL; clean → PASS |
| PT-02 | Manifest integrity tampering | `provenance-security.test.mjs` | `verifyManifestIntegrity()` reject |
| PT-03 | Artifact hash integrity | `provenance-security.test.mjs` | Hash mismatch → verification failure |
| PT-04 | PQC signature failure | `pqc-security.test.mjs` | default WARN; strict FAIL; invalid REJECT |
| PT-05 | Public key registry security | `pqc-security.test.mjs` | Malformed/injected keys reject |
| PT-06 | Hybrid auth envelope security | `hybrid-auth-security.test.mjs` | `verifyHybridAuthEnvelope()` failure |
| PT-07 | Authorization boundary | `penetration-boundary.test.mjs` | AegisShield scenarios reject (structural + optional live) |
| PT-08 | CI security gate | `penetration-boundary.test.mjs` | Required jobs/scripts exist |
| PT-09 | Frozen core integrity | `penetration-boundary.test.mjs` | No diff; hash pins unchanged |
| PT-10 | Supply chain review | `penetration-boundary.test.mjs` | Review report generated; no critical findings |

---

## Execution

```bash
npm run test:penetration
```

Optional live AegisShield contract penetration:

```bash
PT_RUN_SHIELD_LIVE=1 npm run test:penetration
```

---

## CI Integration

| Job | Trigger | Tests |
|-----|---------|-------|
| `security-boundary-check` | PR / push | `test:penetration` (PT-01–PT-10 unit layer) |
| `security-penetration-full` | schedule / manual | `test:penetration` + optional PT-07 live |
| `security-boundary-check` | PR / push | `test:prover-compat` (frozen core T1–T9) |

---

## Success Criteria

- All PT-01–PT-10 checks PASS  
- Frozen core paths show zero git diff  
- `production.zkey` and VK ceremony hashes match pinned constants  
- Phase 8.13 regression suite remains PASS  
- Groth16 core unchanged
