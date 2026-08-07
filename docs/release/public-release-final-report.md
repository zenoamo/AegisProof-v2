# Public Release Final Report

**Date:** 2026-08-08  
**Version:** v2.0.1  
**Repository:** [zenoamo/AegisProof-v2](https://github.com/zenoamo/AegisProof-v2)

> **Groth16 core unchanged.** Frozen paths: `circuits/`, `protocol/`, `packages/sdk/`, `tee/`, verifier contract, hash pins.

---

## Repository

**PASS** (tagged release `v2.0.1`)

| Check | Result |
|-------|--------|
| `master` @ `e0a3a61` | Public release gate complete |
| Tag `v2.0.1` | Points to `e0a3a61` (supersedes `v2.0.0`) |
| `check:sensitive-files` | **PASS** — 0 CRITICAL |
| Migration allowlist | 8 paths (WARN, documented) |
| Unexpected secrets in git | **None** |
| LICENSE / CONTRIBUTING / CoC / SECURITY.md | Present |
| OSS templates | Present |

---

## Tag

**PASS**

| Item | Value |
|------|-------|
| Tag name | `v2.0.1` |
| Tag type | Annotated |
| Tag commit | `e0a3a61abe1360136c1d624ab486fb4a5c8063be` |
| `HEAD` / `master` | Same commit |
| Tag message | "Release v2.0.1" |

Hash pins at tag:

- zkey: `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571`
- VK: `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`

---

## Release Notes

**PASS**

| Item | Path |
|------|------|
| Release notes | [docs/release/v2.0.1-release-notes.md](./v2.0.1-release-notes.md) |
| Release metadata | [.github/release.yml](../../.github/release.yml) |
| README badge | Links to `v2.0.1` release |
| Doc links validated | `npm run validate:doc-links` |

**GitHub Release:** Push tag `v2.0.1` to trigger `.github/workflows/release.yml`, or publish manually at https://github.com/zenoamo/AegisProof-v2/releases/tag/v2.0.1

---

## Clone Verification

**PASS**

```bash
git clone https://github.com/zenoamo/AegisProof-v2.git
cd AegisProof-v2
git checkout v2.0.1

npm ci
npm run check:sensitive-files   # PASS (0 CRITICAL)
npm run test:phase813-gate      # PASS (21/21)
npm run verify:provenance -- --live
npm run test:prover-compat
npm run test:penetration
```

---

## Frozen Core Verification

**PASS**

| Path | Diff |
|------|------|
| `circuits/` | 0 files |
| `protocol/` | 0 files |
| `packages/sdk/` | 0 files |
| `tee/` | 0 files |
| Verifier contract | 0 files |

---

## GitHub Repository Settings (Manual Checklist)

Configure on https://github.com/zenoamo/AegisProof-v2/settings:

| Setting | Recommendation |
|---------|----------------|
| Visibility | Public |
| Default branch | `master` |
| Branch protection | Require `security-boundary-check` on PRs |
| Actions permissions | Read/write for releases workflow |
| Security | Enable Dependabot alerts, CodeQL (via `security.yml`) |
| Releases | Publish v2.0.1 with release notes body |

---

## Final Status

# READY FOR PUBLIC RELEASE

**Conditions met:**

- Tag `v2.0.1` consistent with `master` at `e0a3a61`
- No secrets in repository (0 CRITICAL)
- Security gates and documentation audit complete
- Frozen core immutable

---

**Groth16 core unchanged. Phase 8.13/8.14 compatibility maintained.**
