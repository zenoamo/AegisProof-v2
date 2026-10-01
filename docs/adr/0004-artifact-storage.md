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

The tracked production.zkey copy has now been removed from the repository in the migration branch. The remaining work is to provision the external secure-storage location and update CI/prover resolution to retrieve it without reintroducing the binary into GitHub.
