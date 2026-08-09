# AegisProof v2 Documentation Index

**Last updated:** 2026-08-09

Central index for reviewers, researchers, and OSS contributors.

> **Frozen semantics:** *Frozen* means cryptographic / protocol semantics and security boundaries (30 public signals, `proveCanonical()`, verifier/protocol behavior, ADR-001 TEE isolation) require Architecture Review to change. Operational, CI, provenance, and research layers may evolve additively within those boundaries. See [architecture/overview.md](./architecture/overview.md#frozen-vs-mutable-boundary).

**License:** [MIT](../LICENSE) — see [LICENSE](../LICENSE) at repository root.

**Security:** [SECURITY.md](../SECURITY.md) — vulnerability reporting policy.

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
| [vault-github-oidc.md](./security/vault-github-oidc.md) | GitHub OIDC → Vault trust chain (Task 4) |
| [kms-key-rotation-runbook.md](./security/kms-key-rotation-runbook.md) | Key rotation / revocation runbook |
| [penetration-test-plan.md](./security/penetration-test-plan.md) | PT-01–PT-10 plan |
| [penetration-test-report.md](./security/penetration-test-report.md) | Latest PT execution |
| [penetration-test-completion-report.md](./security/penetration-test-completion-report.md) | PT closure |
| [github-public-release-audit-report.md](./security/github-public-release-audit-report.md) | **Final public release audit** |
| [v2.0.1-release-notes.md](./release/v2.0.1-release-notes.md) | v2.0.1 release notes |

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

### Research Expansion (SSoT)

| Document | Topic |
|----------|-------|
| [implementation-status-matrix.md](./research/implementation-status-matrix.md) | **SSoT** — Implemented / Tested / Mocked / Live Verified |
| [cryptographic-specification.md](./research/cryptographic-specification.md) | Consolidated crypto spec |
| [public-signal-security-rationale.md](./research/public-signal-security-rationale.md) | 30-signal security semantics |
| [threat-model.md](./research/threat-model.md) | Cross-layer threat model |
| [supply-chain-security.md](./research/supply-chain-security.md) | Supply chain research pack |
| [reproducible-builds.md](./research/reproducible-builds.md) | Reproducibility strategy |
| [release-provenance.md](./research/release-provenance.md) | Release signing chain |
| [pqc-readiness.md](./research/pqc-readiness.md) | PQC readiness |
| [hybrid-authentication.md](./research/hybrid-authentication.md) | Hybrid auth research |
| [key-rotation.md](./research/key-rotation.md) | Key rotation / revocation |
| [tee-attestation.md](./research/tee-attestation.md) | TEE attestation research |
| [dcap-vcek.md](./research/dcap-vcek.md) | DCAP / VCEK offline vs online |
| [attestation-to-zk.md](./research/attestation-to-zk.md) | TEE → ZK research pipeline |
| [security-test-catalog.md](./research/security-test-catalog.md) | Negative test threat catalog |

### Phase 8.x Reports

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
