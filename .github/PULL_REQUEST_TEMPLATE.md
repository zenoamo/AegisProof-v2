## Summary

<!-- What does this PR change and why? -->

## Checklist

- [ ] **Frozen Core unchanged** — no edits to `circuits/`, `protocol/`, `packages/sdk/`, `tee/`, verifier contract, zkey/VK hashes, or `publicSignals(30)` layout
- [ ] **No secrets added** — no `.env`, private keys, `.pem`, or credentials
- [ ] **Tests executed** — relevant commands run locally or in CI
- [ ] **Documentation updated** — if behavior or boundaries changed
- [ ] **Provenance updated** — if artifact paths or hashes changed (`npm run verify:provenance -- --live`)

## Tests run

<!-- e.g. npm run test:prover-compat, npm run check:sensitive-files -->

```
(paste commands and results)
```

## Security boundary

- [ ] Ran `npm run check:sensitive-files` (if touching tracked files)

## Related issues

<!-- Fixes #... -->
