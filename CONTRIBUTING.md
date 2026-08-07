# Contributing to AegisProof v2

Thank you for contributing. This project prioritizes auditability and a clear security boundary for public review.

---

## Before You Start

1. Read [docs/architecture/github-repository-boundary.md](docs/architecture/github-repository-boundary.md).
2. Read [docs/adr/0001-frozen-core.md](docs/adr/0001-frozen-core.md) — frozen paths require Architecture Review.
3. Never commit secrets. Run `npm run check:sensitive-files` before opening a PR.

---

## Development Setup

```bash
npm install
npx hardhat compile
npm run test:prover-compat
npm run check:sensitive-files
```

See [docs/getting-started.md](docs/getting-started.md) for the full workflow.

---

## Change Boundaries

### Allowed without Architecture Review

- `scripts/` — tooling, provenance, PQC adapter, CI helpers
- `tests/` — regression and security tests
- `docs/` — documentation
- `.github/workflows/` — CI (must not weaken security gates)
- `benchmarks/` — reports and methodology

### Frozen — Architecture Review required

- `circuits/`, `protocol/`, `packages/sdk/`, `tee/`
- Verifier contract, `production.zkey` hash pin, VK hash pin
- `publicSignals(30)` layout, `proveCanonical()` semantics

### Never commit

- Private keys, `.env`, `.pem`, signing material
- `artifacts/provenance/keys/` contents

---

## Pull Request Process

1. Fork and create a feature branch.
2. Run relevant tests (see PR template checklist).
3. Update documentation if behavior or boundaries change.
4. If artifact paths change, run `npm run verify:provenance -- --live`.
5. Fill out [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).

---

## Verification Commands

| Command | Purpose |
|---------|---------|
| `npm run check:sensitive-files` | Secret boundary scan |
| `npm run test:prover-compat` | T1–T9 Groth16 regression |
| `npm run verify:provenance -- --live` | Artifact hash verification |
| `npm run test:penetration` | PT-01–PT-10 security tests |
| `npm run test:phase813` | Phase 8.13 unified gate |
| `npm run test:kms-signer` | KMS signer abstraction |

---

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Security Reports

Use the [Security issue template](.github/ISSUE_TEMPLATE/security_report.yml). Do not include private keys or live credentials in public issues.

---

## Questions

Open a discussion or issue with the `question` label. For architecture changes affecting the frozen core, describe the motivation and impact on T1–T9 regression.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE), the same license that covers this project.
