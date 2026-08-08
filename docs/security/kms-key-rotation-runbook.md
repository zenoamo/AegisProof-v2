# KMS/HSM Key Rotation Runbook — Phase 8.14 Task 4

**Version:** 1.0  
**Date:** 2026-08-08  
**Aligns with:** [kms-hsm-architecture.md](./kms-hsm-architecture.md)  
**Scope:** ML-DSA-87 provenance keys and operator auth keys — not Groth16 ceremony artifacts  

> **No private keys, tokens, or credentials in this document.**

---

## 1. Key inventory

| Key ID | Role | Algorithm | Backend |
|--------|------|-----------|---------|
| `aegis-provenance-prod-v1` | Artifact provenance | ML-DSA-87 | Vault Transit |
| `aegis-ci-mldsa87-v1` | CI verification baseline | ML-DSA-87 | Vault Transit |
| `aegis-operator-pqc-prod-v1` | Operator auth (PQC) | ML-DSA-87 | Vault Transit |
| `aegis-operator-ecdsa-prod-v1` | Operator auth (classical) | ECDSA secp256k1 | Vault Transit / cloud KMS |

---

## 2. Generation

1. Security officer approves rotation ticket (2-of-3 release officers for provenance keys).
2. Generate new key material **inside HSM/Vault Transit** — never on developer workstations.
3. Export **public key only** for registry staging.
4. Quarantine: key in `Generated` state — no production signing.

```bash
# Operator example — run against Vault CLI with appropriate policy
vault write -f transit/keys/aegis-provenance-prod-v2 type=ml-dsa-87
vault read transit/keys/aegis-provenance-prod-v2
```

Public key hex → stage `artifacts/provenance/public-keys/aegis-provenance-prod-v2.json` (do not commit until activation approval).

---

## 3. Activation

1. Commit registry entry with `"immutable": true`, `"status": "active"`.
2. Update Vault role/policy if key name changes.
3. Update GitHub workflow env `AEGIS_PROVENANCE_KEY_ID` if switching key ID.
4. Run `workflow_dispatch` KMS live smoke in `kms-live-smoke` environment.
5. First release tag after activation signs with new key.

Overlap: keep old key in registry with `"status": "rotating"` until all historical manifests verified.

---

## 4. Public key registry update

Registry path: `artifacts/provenance/public-keys/{keyId}.json`

Required fields:

```json
{
  "keyId": "aegis-provenance-prod-v2",
  "algorithm": "ML-DSA-87",
  "version": "v1",
  "publicKey": "<hex — public material only>",
  "purpose": "Production artifact provenance signer",
  "createdAt": "<ISO8601>",
  "immutable": true,
  "status": "active"
}
```

Verification: `npm run verify:provenance -- --manifest path --pqc`

---

## 5. Overlap period

| Phase | Old key | New key | Registry |
|-------|---------|---------|----------|
| Pre-activation | Active | Generated | Old only |
| Overlap | Rotating (verify-only) | Active (sign) | Both committed |
| Post-overlap | Retired | Active | Old marked retired |

Minimum overlap: 30 days or two release cycles, whichever is longer.

---

## 6. Retirement

1. Set old registry entry `"status": "retired"`.
2. Disable signing on old Vault Transit key version (minimize to verify-only policy).
3. Confirm no CI/workflow references old `AEGIS_PROVENANCE_KEY_ID`.
4. Archive audit logs for rotation window.

Retired keys remain in registry for historical manifest verification.

---

## 7. Revocation

**Triggers:** key compromise, policy violation, personnel change, audit finding.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Immediately disable Vault Transit key / role | Security |
| 2 | Revoke active Vault tokens (auth revoke) | Platform |
| 3 | Remove compromised key from signing policy | Security |
| 4 | Mark registry `"status": "revoked"` | Release Eng |
| 5 | Incident report + post-mortem | Security |

Emergency: skip overlap — activate pre-staged standby key (`aegis-provenance-prod-vN+1`).

---

## 8. Emergency rotation

1. **Detect** — monitoring alert, audit anomaly, or manual report.
2. **Contain** — disable `ci-provenance-signer` role if OIDC path compromised.
3. **Rotate** — activate standby key in Vault Transit (pre-generated in quarantine).
4. **Registry** — commit new public key within 4 business hours.
5. **Re-sign** — optional manifest re-sign for in-flight releases (operator decision).
6. **Verify** — `workflow_dispatch` smoke + test tag in staging environment.

Fail closed: if emergency key not ready, **hold releases** rather than fall back to stub/local signing.

---

## 9. Recovery

| Scenario | Recovery |
|----------|----------|
| Vault total outage | Wait for Vault recovery; do not bypass with local keys for production |
| Wrong key active | Roll back registry commit; revert `AEGIS_PROVENANCE_KEY_ID` |
| Partial sign failure | Release workflow fails; fix Vault key/policy; re-push tag (new patch tag) |
| Lost public key registry | Restore from git history — public keys only |
| Lost private key | **Non-recoverable** — generate new key; old manifests verify with retired registry entry |

---

## 10. OIDC role rotation

Independent from signing key rotation:

1. Create new Vault JWT role with tighter bindings.
2. Update `VAULT_JWT_ROLE` in GitHub workflows.
3. Disable old role after successful smoke test.
4. Review GitHub environment protection rules.

See [vault-github-oidc.md](./vault-github-oidc.md).

---

## 11. Checklist templates

### Planned rotation

- [ ] Ticket approved  
- [ ] New key generated in Vault/HSM  
- [ ] Public key staged  
- [ ] Smoke test PASS (`kms-live-smoke`)  
- [ ] Registry committed  
- [ ] Workflow env updated  
- [ ] Old key retired after overlap  

### Emergency rotation

- [ ] Compromised key disabled  
- [ ] Standby key activated  
- [ ] OIDC role reviewed  
- [ ] Registry updated  
- [ ] Incident documented  

---

## 12. Related

- [kms-hsm-architecture.md](./kms-hsm-architecture.md) — lifecycle states, RACI  
- [vault-github-oidc.md](./vault-github-oidc.md) — OIDC trust chain  
- [kms-signer-design.md](./kms-signer-design.md) — signer API and backends  
