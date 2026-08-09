# AegisProof v2 — Hybrid Authentication (Research)

**Status:** RESEARCH-ONLY — not connected to production deployment  
**Module:** `scripts/lib/hybrid-auth-envelope.mjs`  
**Phase origin:** 8.13 Task 6

---

## 1. Purpose

Research layer combining **classical ECDSA (secp256k1)** and **ML-DSA-87** for operator/authentication envelopes. Validates dual-signature verification order without modifying protocol contracts or SDK.

---

## 2. Verification Order

```
payload structure validation
    → domain separation (AEGIS_AUTH_ENVELOPE_V1)
    → classical ECDSA verify
    → ML-DSA-87 verify
```

Both must pass for envelope acceptance in strict mode.

---

## 3. Status Matrix

| Aspect | Status |
|--------|--------|
| Implementation | ✅ IMPLEMENTED |
| Unit tests | ✅ `test:hybrid-auth`, `hybrid-auth-security.test.mjs` |
| Benchmarks | ✅ `bench:hybrid-auth` — ECDSA ~1ms p50, ML-DSA ~5ms p50 |
| deploy.ts integration | ❌ NOT wired |
| Production deployment | ❌ RESEARCH-ONLY |
| Live Verified | ❌ NOT VERIFIED |

---

## 4. Relationship to Groth16

Hybrid auth protects **operator/authentication metadata** — not Groth16 proofs or public signals.

**Does not:**
- Replace nullifier/commitment logic
- Modify verifier contract
- Change `proveCanonical()` semantics

---

## 5. Key Material Policy

| Environment | Source |
|-------------|--------|
| Development | Ephemeral / dev keys via tooling |
| CI | Ephemeral generated on runner |
| Production | Vault/HSM (design only — NOT VERIFIED) |

Private keys: **never committed**

---

## 6. Failure Semantics

| Failure | Result |
|---------|--------|
| Invalid payload shape | reject before crypto |
| Domain mismatch | reject |
| Classical sig invalid | reject (PQC not evaluated) |
| PQC sig invalid | reject |
| Unknown registry keyId | reject |

---

## References

- [phase8.13-hybrid-auth-envelope.md](./phase8.13-hybrid-auth-envelope.md)
- [phase8.13-hybrid-auth-inventory.md](./phase8.13-hybrid-auth-inventory.md)
- [pqc-readiness.md](./pqc-readiness.md)
- [public-key-registry.mjs](../../scripts/lib/public-key-registry.mjs)
