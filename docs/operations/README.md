# Operations Documentation

Deployment, key management, and incident response guides for AegisProof v2 operators.

> **Note:** No mainnet deployment has been performed. Documents describe procedures and policies, not live production state.

---

## Deployment

| Document | Description |
|----------|-------------|
| [deployment.md](../deployment.md) | General deployment guide |
| [deployment-playbook.md](../deployment-playbook.md) | Step-by-step playbook |
| [deployment-checklist.md](../deployment-checklist.md) | Pre-deployment checklist |
| [deployment-mainnet.md](../deployment-mainnet.md) | Mainnet considerations (planning) |
| [production-acceptance.md](../production-acceptance.md) | Acceptance criteria |

---

## Security Operations

| Document | Description |
|----------|-------------|
| [key-management-policy.md](../key-management-policy.md) | Key lifecycle policy |
| [incident-response.md](../incident-response.md) | Incident response |
| [security/kms-hsm-architecture.md](../security/kms-hsm-architecture.md) | KMS/HSM design (Phase 8.14) |
| [security/artifact-policy.md](../security/artifact-policy.md) | Artifact governance |

---

## Ceremony and Artifacts

| Document | Description |
|----------|-------------|
| [phase4-ceremony-report.md](../phase4-ceremony-report.md) | Production ceremony |
| [ceremony-artifact-verification.md](../ceremony-artifact-verification.md) | Artifact verification |
| [artifact-retention.md](../artifact-retention.md) | Retention policy |

---

## CI / Release

| Document | Description |
|----------|-------------|
| [kms-live-operator-checklist.md](./kms-live-operator-checklist.md) | **Phase 8.14** — OIDC → Vault live integration operator checklist |
| [../.github/workflows/aegis_repro_ci.yml](../../.github/workflows/aegis_repro_ci.yml) | Primary CI workflow |
| [../.github/workflows/security-kms-live-smoke.yml](../../.github/workflows/security-kms-live-smoke.yml) | Protected KMS live smoke (workflow_dispatch) |
| [../.github/workflows/release.yml](../../.github/workflows/release.yml) | Release with live KMS provenance |
| [../.github/workflows/security.yml](../../.github/workflows/security.yml) | CodeQL and dependency review |
| [RELEASE_ENGINEERING.md](../../RELEASE_ENGINEERING.md) | Release process |
