# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public issue for sensitive vulnerabilities.**

Use the [Security Report issue template](.github/ISSUE_TEMPLATE/security_report.yml) and include:

- Affected area (repository boundary, provenance, PQC, CI, etc.)
- Summary and impact
- Sanitized reproduction steps

**Never include** private keys, `.env` values, HSM credentials, or live exploit payloads in public reports.

For details that must stay private, note how maintainers can reach you securely in the report.

## Security Boundary

This repository enforces a public/private split:

- **Public (GitHub):** source, tests, documentation, hash pins, public keys, CI workflows
- **Private (external):** operator secrets, HSM credentials, production signing keys

Run before contributing:

```bash
npm run check:sensitive-files   # 0 CRITICAL required
npm run test:penetration        # PT-01–PT-10
```

See [docs/security/repository-boundary-report.md](docs/security/repository-boundary-report.md) for the full boundary policy.

## Scope

In scope:

- Secret exposure in the repository or CI
- Artifact provenance / hash integrity bypass
- PQC metadata signing layer weaknesses
- Supply chain / dependency risks in CI

Out of scope:

- Theoretical attacks requiring mainnet deployment (mainnet is not active)
- TEE research adapter (`tee/`) — isolated research layer per ADR-001

## Response

Maintainers triage reports labeled `security` and respond as capacity allows. This is a research and review repository; no SLA is guaranteed.
