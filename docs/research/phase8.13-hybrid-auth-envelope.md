# Hybrid Auth Envelope (Phase 8.13)

**Status:** Research layer complete  
**Phase:** 8.13 Task 6  
**Prerequisite:** Task 4 (ML-DSA adapter), Task 5 (CI provenance hardening)  

---

## Purpose

Implement an outer-layer hybrid authentication envelope for operator and deployment authorization without modifying the frozen Groth16 ZK core or protocol contracts.

```
Operator
  ↓
Hybrid Auth Envelope
  ├─ classical signature (ECDSA secp256k1 — compatibility)
  └─ ML-DSA-87 signature (PQC additive)
  ↓
Authorization verifier (scripts/ only)
  ↓
deploy.ts / Hardhat (unchanged contract path)
```

---

## Threat Model

| Threat | Mitigation (Task 6) |
|--------|---------------------|
| Unauthorized deployment | Hybrid envelope verify before script execution (future gate) |
| Operator key compromise (classical) | Additive PQC signature requirement (future phase) |
| Payload tampering | Canonical JSON + domain separation |
| Algorithm downgrade | Envelope algorithm fields checked |
| Signature replay | Payload binds operator, action, timestamp |
| Groth16 / protocol attack | **Out of scope** — envelope does not touch ZK path |

---

## Envelope Schema

```json
{
  "domain": "AEGIS_AUTH_ENVELOPE_V1",
  "version": "v1",
  "payload": {
    "domain": "AEGIS_DEPLOYMENT_AUTH_V1",
    "operator": "0x…",
    "action": "deploy-verifier",
    "timestamp": "ISO-8601",
    "chainId": 1
  },
  "classicalSignature": {
    "algorithm": "ECDSA",
    "curve": "secp256k1",
    "signature": "<hex>"
  },
  "pqcSignature": {
    "algorithm": "ML-DSA-87",
    "version": "v1",
    "signature": "<hex>",
    "publicKey": "<hex>",
    "publicKeyId": "aegis-ci-mldsa87-v1"
  },
  "createdAt": "ISO-8601"
}
```

### Rules

- Classical signature: optional (compatibility mode)
- PQC signature: optional (research mode)
- Required enforcement: **future phase** — not CI gate in Task 6

---

## Signature Composition

### Signing message

```
AEGIS_AUTH_ENVELOPE_V1\n{canonical-json-payload}
```

Payload keys sorted recursively. Separate from provenance domain (`AEGIS_ARTIFACT_PROVENANCE_V1`).

### Verification order

1. Canonical payload validation (`AEGIS_DEPLOYMENT_AUTH_V1`, operator, action)
2. Envelope domain separation (`AEGIS_AUTH_ENVELOPE_V1`)
3. Classical ECDSA verify (if present)
4. ML-DSA-87 verify (if present)

---

## API

| Function | Purpose |
|----------|---------|
| `createDeploymentAuthPayload()` | Unsigned authorization payload |
| `createHybridAuthEnvelope()` | Sign classical and/or PQC |
| `verifyHybridAuthEnvelope()` | Full verification pipeline |
| `generateClassicalKeypair()` | secp256k1 test keys |
| `generatePqcKeypair()` | ML-DSA-87 test keys |

Legacy wrappers: `createHybridEnvelope()` / `verifyHybridEnvelope()` (Task 1–4 compat).

---

## Migration Path

| Phase | Action |
|-------|--------|
| **8.13 Task 6** | Research envelope + unit tests (this task) |
| **8.14** | KMS/HSM key lifecycle for production operator keys |
| **8.15+** | Optional CI gate on deployment scripts |
| **9** | PQ-ZK migration research (separate from auth envelope) |

Existing deployments and on-chain operator model **remain valid** without envelope.

---

## Rollback Strategy

1. Remove hybrid auth CI job → no impact on production
2. Stop calling `verifyHybridAuthEnvelope()` in scripts → deploy.ts unchanged
3. Delete envelope module → zero protocol/circuit impact

---

## Why Protocol Remains Frozen

- On-chain authorization semantics are battle-tested and audited
- Hybrid envelope is **additive metadata** for off-chain policy
- Groth16 proof verification path has no dependency on operator auth envelope
- tee/ ADR-001 boundary preserved — TEE attestation ≠ deployment auth

---

## PQC Boundary

| Layer | Touches Groth16? |
|-------|------------------|
| Hybrid auth (`scripts/lib/hybrid-auth-envelope.mjs`) | **No** |
| Artifact provenance (`scripts/lib/pqc-signature.mjs`) | **No** |
| Protocol / verifier / SDK | **Frozen** |

---

## Tests

| ID | Case |
|----|------|
| T-AUTH-01 | Valid classical only |
| T-AUTH-02 | Valid PQC only |
| T-AUTH-03 | Valid hybrid |
| T-AUTH-04 | Payload mutation reject |
| T-AUTH-05 | Domain separation reject |
| T-AUTH-06 | Wrong PQC key reject |
| T-AUTH-07 | Algorithm downgrade reject |
| T-AUTH-08 | Signature replay reject |

```bash
npm run test:hybrid-auth
```

---

## Related

- `docs/research/phase8.13-hybrid-auth-inventory.md` — auth flow inventory
- `benchmarks/reports/hybrid-auth-benchmark.json` — verify latency
- `docs/research/phase8.13-pqc-ci-policy.md` — provenance trust boundary
