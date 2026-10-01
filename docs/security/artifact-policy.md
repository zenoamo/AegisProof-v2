# Artifact Policy

**Version:** 1.0  
**Date:** 2026-08-08  
**Scope:** Artifact governance for AegisProof v2 public release

---

## Artifact Classification

### Public (GitHub)

| Asset | Location | Content |
|-------|----------|---------|
| Metadata | `artifacts/provenance/manifest.json` | Schema, pins, entry metadata |
| Hashes | Manifest entries + `resolve-artifacts.mjs` | SHA-256 digests |
| Provenance | Manifest + public key registry | Integrity + optional ML-DSA-87 authenticity |
| Ceremony records | `artifacts/phase4/ceremony/`, `transcripts/`, `hashes/` | Non-secret audit trail |
| Public keys | `artifacts/provenance/public-keys/*.json` | ML-DSA-87 verify keys |
| Dev evidence | `artifacts/phase2/` (selected) | vkey, test vectors, reports |

### External (secure storage — target)

| Asset | Current state | Target |
|-------|---------------|--------|
| `production.zkey` | Migration debt in `crypto-artifacts/` | HSM / encrypted object store |
| `*.ptau` ceremony files | Migration debt (5 paths) | External archive |
| Dev zkey / wtns | Migration debt | External or regenerable |
| ML-DSA private keys | Gitignored (`artifacts/provenance/keys/`) | Vault / HSM |
| Operator signing keys | Never in repo | HSM |

---

## Lifecycle

```
Generate  →  Hash  →  Manifest  →  Verify  →  Retire
   │           │          │            │          │
   │           │          │            │          └─ Deprecate entry; keep hash history
   │           │          │            └─ CI: verify:provenance --live
   │           │          └─ artifacts/provenance/manifest.json
   │           └─ SHA-256 per file (resolveArtifacts)
   └─ Build / ceremony (off-repo for production zkey)
```

### Verification order

1. Manifest structural integrity (`verifyManifestIntegrity`)
2. Live file SHA-256 vs manifest entry
3. Pinned production hashes (`production.zkey`, VK ceremony hash)
4. Optional ML-DSA-87 signature (`verifyPqcSignatureEnvelope`)

---

## Storage Policy

| Tier | Stores | Access |
|------|--------|--------|
| **GitHub** | Source, docs, manifest, public keys, hash pins | Public clone |
| **Secure Storage** | `production.zkey`, ptau, private keys | OIDC + short-lived credentials |
| **HSM / Vault** | Signing keys (provenance, operator auth) | Policy-gated sign operations |

See [kms-hsm-architecture.md](./kms-hsm-architecture.md) for key management design.

---

## Resolver

All prover/bench/verify scripts use `resolveArtifacts()` (`scripts/lib/resolve-artifacts.mjs`):

- Canonical paths under `artifacts/phase2/` and `artifacts/phase4/`
- Fallback to `crypto-artifacts/` mirror
- Pinned constants: `PRODUCTION_ZKEY_HASH`, `PRODUCTION_VKEY_HASH`

---

## CI Requirements

| Tier | Command | PQC |
|------|---------|-----|
| PR / push | `verify:provenance -- --live` | WARN if unsigned |
| Schedule / manual | `verify:provenance -- --live --pqc` | Required |

---

## References

- [artifact-retention.md](../artifact-retention.md)
- [github-repository-boundary.md](../architecture/github-repository-boundary.md)
- ADR [0002-provenance.md](../adr/0002-provenance.md), [0004-artifact-storage.md](../adr/0004-artifact-storage.md)


## Migration update — 2026-10-01

production zkey current state: removed from public GitHub working tree; external secure storage provisioning remains pending. During migration, CI/prover workflows must not assume a repository-local production zkey.
