# AegisProof v2 Documentation Index

**Last updated:** 2026-08-08

Central index for reviewers, researchers, and OSS contributors.

**License:** [MIT](../LICENSE) — see [LICENSE](../LICENSE) at repository root.

---

## Start Here

| Document | Audience | Description |
|----------|----------|-------------|
| [../README.md](../README.md) | All | Project overview, quick start, CI |
| [getting-started.md](./getting-started.md) | Developers | Local setup and verification |
| [architecture/overview.md](./architecture/overview.md) | Reviewers | System overview |
| [general-audience-30sec.md](./general-audience-30sec.md) | Non-technical | 30-second summary (Japanese) |

---

## architecture/

| Document | Topic |
|----------|-------|
| [overview.md](./architecture/overview.md) | Groth16 protocol overview |
| [aegisproof-v2-full-architecture.md](./architecture/aegisproof-v2-full-architecture.md) | Full architecture diagrams |
| [github-repository-boundary.md](./architecture/github-repository-boundary.md) | GitHub vs external storage |
| [github-security-boundary.md](./architecture/github-security-boundary.md) | Trust model and enforcement |
| [tee-pipeline.md](./architecture/tee-pipeline.md) | TEE adapter (research) |

---

## security/

| Document | Topic |
|----------|-------|
| [repository-boundary-report.md](./security/repository-boundary-report.md) | Public release boundary audit |
| [sensitive-file-policy.md](./security/sensitive-file-policy.md) | Secret scanning policy |
| [artifact-policy.md](./security/artifact-policy.md) | Artifact classification and lifecycle |
| [kms-hsm-architecture.md](./security/kms-hsm-architecture.md) | Production key management (design) |
| [kms-signer-design.md](./security/kms-signer-design.md) | KMS signer module |
| [penetration-test-plan.md](./security/penetration-test-plan.md) | PT-01–PT-10 plan |
| [penetration-test-report.md](./security/penetration-test-report.md) | Latest PT execution |
| [penetration-test-completion-report.md](./security/penetration-test-completion-report.md) | PT closure |
| [github-public-release-audit-report.md](./security/github-public-release-audit-report.md) | **Final public release audit** |
| [v2.0.0-release-notes.md](./release/v2.0.0-release-notes.md) | v2.0.0 release notes |

---

## operations/

| Document | Topic |
|----------|-------|
| [operations/README.md](./operations/README.md) | Deployment and ops index |
| [deployment.md](./deployment.md) | Deployment guide |
| [deployment-playbook.md](./deployment-playbook.md) | Operational playbook |
| [incident-response.md](./incident-response.md) | Incident response |
| [key-management-policy.md](./key-management-policy.md) | Key management |

---

## research/

Phase 8.x research documents: PQC wrapper, hybrid auth, TEE evaluation, Phase 9 roadmap.

| Document | Topic |
|----------|-------|
| [phase8.13-architecture-summary.md](./research/phase8.13-architecture-summary.md) | Phase 8.13 closure |
| [phase8.13-final-completion-report.md](./research/phase8.13-final-completion-report.md) | Phase 8.13 final report |
| [phase8.14-task1-completion-report.md](./research/phase8.14-task1-completion-report.md) | KMS/HSM design |
| [phase8.14-task2-completion-report.md](./research/phase8.14-task2-completion-report.md) | KMS signer layer |

---

## perf/

| Document | Topic |
|----------|-------|
| [prover-regression-contract.md](./perf/prover-regression-contract.md) | T1–T9 regression contract |
| [prover-benchmark-baseline.md](./perf/prover-benchmark-baseline.md) | Benchmark methodology |
| [provenance-verification.md](./perf/provenance-verification.md) | Provenance overhead |

---

## adr/

| ADR | Title |
|-----|-------|
| [0001-frozen-core.md](./adr/0001-frozen-core.md) | Frozen Groth16 core |
| [0002-provenance.md](./adr/0002-provenance.md) | Artifact provenance |
| [0003-pqc-layer.md](./adr/0003-pqc-layer.md) | ML-DSA-87 outer layer |
| [0004-artifact-storage.md](./adr/0004-artifact-storage.md) | Storage boundary |
| [001-architecture-hardening-freeze.md](./adr/001-architecture-hardening-freeze.md) | TEE hardening freeze |

---

## Verification Commands

```bash
npm run check:sensitive-files
npm run verify:provenance -- --live
npm run test:prover-compat
npm run test:penetration
npm run test:phase813
```

---

## External Audit

- [EXTERNL_AUDIT_INDEX.md](../EXTERNL_AUDIT_INDEX.md)
- [external-audit-package.md](./external-audit-package.md)
- [security-review-package.md](./security-review-package.md)
