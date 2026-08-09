# AegisProof v2 — Supply Chain Security (Research)

**Status:** Research documentation (Phase B)
**Scope:** Dependency integrity, artifact pinning, provenance, migration debt
**Live infrastructure:** NOT VERIFIED

---

## 1. Threat Model Summary

See [threat-model.md](./threat-model.md) §7 (T-SC-001–003).

**Primary assets:**
- Groth16 artifacts (`production.zkey`, WASM, VK)
- npm dependency graph
- Provenance manifest integrity
- Signing keys (never in git)

---

## 2. Dependency Integrity

### Production vs development boundary

| Category | Location | Policy |
|----------|----------|--------|
| Production runtime | `dependencies` | Minimal: circomlib, dotenv, fastify, viem |
| Dev / tooling | `devDependencies` | circomlibjs, snarkjs, hardhat, @noble/post-quantum |
| Optional cloud SDKs | `optionalDependencies` | AWS/Azure/GCP — not required for core verify |

### elliptic removal (VULN-010)

**Evidence:** `circomlibjs` moved to `devDependencies`. Production tree check:

```bash
npm ls elliptic --omit=dev
# → (empty)
```

Regression: `tests/security/elliptic-supply-chain.test.mjs` T-EXP-010A–D

**Status:** FIXED — elliptic absent from production dependency tree

### Unrelated advisories

`ws` advisory via `viem` is **out of VULN-010 scope** — tracked separately in supply-chain review WARN findings.

---

## 3. Lockfile Integrity

| Control | Implementation |
|---------|----------------|
| Lock file | `package-lock.json` committed |
| CI install | `npm ci` (not `npm install`) |
| Digest tracking | `benchmarks/reports/supply-chain-review.json` → `lockDigest` |
| Drift detection | Supply-chain review script on penetration/CI path |

---

## 4. SHA-256 Artifact Pinning

| Artifact | Hash pin | Enforcer |
|----------|----------|----------|
| `production.zkey` | `ce5a3d30…6571` | `resolve-artifacts.mjs`, manifest |
| VK ceremony | `d012bd29…d2ec` | `resolve-artifacts.mjs`, manifest |
| WASM | prefix pin | manifest entries |

**Verification order:** manifest integrity → live SHA-256 → optional PQC (ADR-0002)

---

## 5. Provenance Manifest

- **SSoT:** `artifacts/provenance/manifest.json`
- **Module:** `scripts/lib/artifact-provenance.mjs`
- **CI:** `npm run verify:provenance -- --live` — PR hard gate
- **KMS envelopes:** Phase 8.14 — mocked tests PASS; live **NOT VERIFIED**

---

## 6. SBOM Strategy (Research)

**Current state:** No formal SPDX/CycloneDX SBOM committed.

**Recommended approach (additive, no Frozen Core impact):**

1. Generate SBOM from `package-lock.json` in CI (schedule/manual job)
2. Attach SBOM digest to provenance manifest metadata (future schema extension)
3. Cross-reference `lockDigest` in supply-chain review
4. Do **not** treat SBOM alone as integrity proof — hash pins remain authoritative

---

## 7. Migration Debt

8 allowlisted paths per [repository-boundary-report.md](../security/repository-boundary-report.md):

| Path type | Count | Target |
|-----------|-------|--------|
| production.zkey | 1 | External secure storage |
| ceremony ptau | 5 | External archive |
| dev zkey / witness | 2 | Regenerable / exclude |

**Policy:** New unallowlisted sensitive paths → FAIL. Allowlisted → WARN.

---

## 8. Secret Boundary

```bash
npm run check:sensitive-files  # CRITICAL 0 required
```

Categories: private keys, `.env`, PQC keys in `artifacts/provenance/keys/` (gitignored)

---

## 9. Residual Risks

| Risk | Status |
|------|--------|
| Binaries in git (migration debt) | WARN — documented |
| PR-tier unsigned PQC | WARN — by design |
| Live KMS release signing | NOT VERIFIED |
| Formal SBOM | Not implemented |

---

## References

- [repository-boundary-report.md](../security/repository-boundary-report.md)
- [artifact-policy.md](../security/artifact-policy.md)
- [reproducible-builds.md](./reproducible-builds.md)
- [release-provenance.md](./release-provenance.md)
