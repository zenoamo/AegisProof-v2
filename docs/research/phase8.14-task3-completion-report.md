# Phase 8.14 Task 3 — KMS/HSM Live Backend Hardening Completion Report

**Date:** 2026-08-08  
**Scope:** Vault Transit + Cloud HSM live backend hardening only  
**Groth16 core:** unchanged

---

## Summary

Task 3 hardens the KMS signer abstraction (`scripts/lib/kms-signer.mjs`) and backend modules (`scripts/lib/kms-backends/*`) for production connection readiness. Live mode fails closed; stub mode remains CI default.

---

## Backend Status

| Backend | Status | Notes |
|---------|--------|-------|
| mock-hsm | **READY (test)** | In-memory; `test-` keyId prefix; unit tests only |
| vault-transit | **READY (live + stub)** | Live: HTTP sign/verify, timeout, auth errors; Stub: CI default |
| cloud-hsm/http | **READY (live)** | HSM gateway proxy for ML-DSA-87 provenance |
| AWS KMS | **READY (ECDSA only)** | `operator-classical`; ML-DSA rejected explicitly |
| GCP KMS | **READY (ECDSA only)** | Same boundary as AWS |
| Azure Key Vault | **READY (ECDSA only)** | Same boundary as AWS |

---

## Live vs Stub Policy

| Mode | Behavior |
|------|----------|
| `KMS_BACKEND_MODE=stub` (default) | Vault uses deterministic stub when unset; cloud-hsm throws if unconfigured |
| `KMS_BACKEND_MODE=live` | Vault and cloud-hsm require full config; **stub fallback forbidden** |

CI sets stub mode in `run-kms-signer.mjs`. PR workflows do not connect to live Vault/HSM.

---

## Security

| Check | Result |
|-------|--------|
| Secrets introduced in source | 0 |
| Private keys generated in repo | 0 |
| Private keys stored in repo | 0 |
| `exportPrivateKeyMaterial()` | `EXPORT_FORBIDDEN` |
| Live → stub fallback | Forbidden |
| Token/credential logging | Redacted via `redactKmsSecrets()` |

---

## Provenance Integration (unchanged)

Signing path remains separated:

```
generate:provenance → canonical payload → pqc-signature.mjs (local dev key)
                     ↘ future: kms-signer → Vault/HSM (Task 4+ CI wiring)
verify:provenance → SHA-256 + optional ML-DSA verify
```

Task 3 does **not** force production manifest signing in CI.

---

## Tests

| Command | Result |
|---------|--------|
| `npm run test:kms-signer` | PASS — 59 checks (36 + 23 hardening) |
| `npm run test:penetration` | PASS |
| `npm run test:phase813-gate` | PASS |
| `npm run test:pqc-signature` | PASS |
| `npm run verify:provenance -- --live` | PASS |
| `npm run validate:doc-links` | PASS — 77 links |

---

## Frozen Core

No changes to: `circuits/`, `protocol/`, `packages/sdk/`, `tee/`, verifier, hash pins, `publicSignals`, `proveCanonical()`.

---

## Remaining Technical Debt

1. GitHub OIDC → Vault role binding for CI/release signing (Task 4)
2. Provenance manifest auto-sign on release tag (Task 4)
3. Hybrid auth → deployment script integration (Task 4+)
4. PR-tier strict `--require-pqc` promotion (Task 4+)
5. Live integration tests against real Vault/HSM (manual / protected environment only)
6. AWS/GCP/Azure native ML-DSA-87 support depends on future cloud KMS API availability — not confirmed in this adapter

---

## Next Task (Task 4 — not implemented)

1. Wire GitHub OIDC JWT auth to Vault for `provenance-signing` environment
2. Add optional `workflow_dispatch` job for live KMS integration smoke (protected secrets)
3. Connect `generate:provenance` to KMS signer when `KMS_BACKEND_MODE=live` in release workflow
4. Document operator runbook for production key rotation with live backends

---

**Groth16 core unchanged. KMS/HSM layer hardened; production CI automation deferred to Task 4.**
