# ADR-0004: Artifact Storage Boundary

## Status

Accepted

## Date

2026-08-08

## Context

Large cryptographic binaries (`production.zkey`, ptau, wtns) were tracked for CI reproducibility. Public GitHub release requires a clear boundary between committable metadata and external binary storage.

## Decision

1. **GitHub stores:** hashes, manifests, ceremony transcripts, public keys, source code.
2. **External storage (target):** `production.zkey`, ptau files, private signing keys.
3. **Migration debt:** 8 paths allowlisted in `scripts/sensitive-files-allowlist.json` until migrated.
4. **Enforcement:** `check:sensitive-files` blocks new CRITICAL paths; WARN on allowlisted migration paths.
5. **Resolver:** `resolveArtifacts()` supports `crypto-artifacts/` mirror during migration.

New production.zkey commits are blocked by `.gitignore` and scanner; existing tracked copy is grandfathered.

## Consequences

- **Positive:** Clear audit story for public release.
- **Positive:** Hash pins remain verifiable without binary in target state.
- **Negative:** Cloners need `crypto-artifacts/` mirror or external fetch for full prover runs.
- **Action:** Migrate 8 allowlisted paths to secure storage; enable `--strict` scanner when complete.

## References

- [repository-boundary-report.md](../security/repository-boundary-report.md)
- [sensitive-file-policy.md](../security/sensitive-file-policy.md)
- [github-repository-boundary.md](../architecture/github-repository-boundary.md)


## Migration update — 2026-10-01

The tracked production.zkey copy has now been removed from the repository in the migration branch. `resolveArtifacts()` accepts an operator-provisioned absolute path through `AEGIS_PRODUCTION_ZKEY_PATH`; strict CI verifies that file against `PRODUCTION_ZKEY_HASH` before provenance verification.

The secure-storage download backend, object identifier, and credential/OIDC
contract are not defined in this repository. Until operators configure that
provisioning step, strict scheduled/manual provenance verification is
fail-closed (`BLOCKED`), not silently downgraded. PR and repository regression
tiers explicitly allow the absent external zkey, but continue to verify the
committed hash pin and all available artifacts.
