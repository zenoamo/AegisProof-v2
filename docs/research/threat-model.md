# AegisProof v2 — Cross-Layer Threat Model

**Status:** Documentation consolidation (Phase A)  
**Scope:** ZK · Provenance · PQC · KMS · OIDC · TEE · Supply Chain · Release  
**Live infrastructure:** **NOT VERIFIED** unless explicitly noted with operator evidence

---

## 1. Methodology

Each threat entry uses:

| Field | Description |
|-------|-------------|
| **Asset** | What is protected |
| **Trust Boundary** | Where enforcement occurs |
| **Attacker** | Threat actor model |
| **Precondition** | Required attacker capability |
| **Attack** | Adverse action |
| **Existing Mitigation** | Current controls |
| **Residual Risk** | Remaining exposure |
| **Evidence** | Test / doc / CI reference |

---

## 2. ZK Layer

### T-ZK-001: Forged Groth16 proof

| Field | Value |
|-------|-------|
| Asset | Proof soundness |
| Trust Boundary | Groth16 verifier (off-chain + on-chain) |
| Attacker | Malicious prover |
| Precondition | Invalid witness or broken trusted setup |
| Attack | Submit proof accepting false statement |
| Existing Mitigation | Groth16 soundness; trusted setup ceremony; T1–T9 regression |
| Residual Risk | MEDIUM if ceremony compromised; LOW under standard assumptions |
| Evidence | `tests/prover-compatibility.test.ts`, hash pins |

### T-ZK-002: Cross-chain replay

| Field | Value |
|-------|-------|
| Asset | Nullifier uniqueness per chain |
| Trust Boundary | Circuit + contract |
| Attacker | Prover reusing proof on another chain |
| Precondition | Valid proof from chain A |
| Attack | Replay on chain B |
| Existing Mitigation | `chainId` in nullifier; contract `block.chainid` check |
| Residual Risk | LOW |
| Evidence | `protocol/specs` index 22; contract policy |

### T-ZK-003: Double-spend (nullifier reuse)

| Field | Value |
|-------|-------|
| Asset | One-time consumption |
| Trust Boundary | Contract nullifier registry |
| Attacker | Prover or relayer |
| Precondition | Valid proof |
| Attack | Submit same nullifier twice |
| Existing Mitigation | `usedNullifiers` mapping |
| Residual Risk | LOW on-chain |
| Evidence | Contract tests, PT suite |

---

## 3. Provenance Layer

### T-PROV-001: Artifact binary tampering

| Field | Value |
|-------|-------|
| Asset | `production.zkey`, WASM, VK integrity |
| Trust Boundary | SHA-256 manifest + live verify |
| Attacker | Supply-chain adversary |
| Precondition | Write access to tracked artifacts |
| Attack | Replace binary; run prover on malicious zkey |
| Existing Mitigation | `verify:provenance --live`; pinned hashes; PR CI hard gate |
| Residual Risk | LOW if CI enforced; MEDIUM if local verify skipped |
| Evidence | PT-02, PT-03; `provenance-security.test.mjs` |

### T-PROV-002: Stale manifest replay

| Field | Value |
|-------|-------|
| Asset | Manifest freshness vs live files |
| Trust Boundary | Live hash comparison |
| Attacker | Contributor with old manifest |
| Precondition | Artifact updated without manifest regen |
| Attack | Commit outdated manifest passing schema checks |
| Existing Mitigation | `--live` recomputes hashes; mismatch fails |
| Residual Risk | LOW |
| Evidence | T-RES-001 (research catalog) |

### T-PROV-003: KMS envelope inheritance after hash change

| Field | Value |
|-------|-------|
| Asset | KMS signature bound to artifact hash |
| Trust Boundary | `preserveVerifiedKmsEnvelopes()` |
| Attacker | Release process adversary |
| Precondition | Regenerated manifest with changed artifact |
| Attack | Retain old KMS envelope on new hash |
| Existing Mitigation | Hash change drops envelope (VULN-004 fix) |
| Residual Risk | LOW |
| Evidence | T-EXP-004F; `9562d22` |

---

## 4. PQC Layer

### T-PQC-001: Unsigned manifest on PR tier

| Field | Value |
|-------|-------|
| Asset | ML-DSA metadata authenticity |
| Trust Boundary | CI tier policy |
| Attacker | PR contributor |
| Precondition | No PQC private key in CI |
| Attack | Merge unsigned manifest |
| Existing Mitigation | WARN on PR; strict tier on schedule/manual |
| Residual Risk | MEDIUM on PR path — by design during review period |
| Evidence | `phase8.13-pqc-ci-policy.md`; ADR-0003 |

### T-PQC-002: PQC mistaken for ZK soundness

| Field | Value |
|-------|-------|
| Asset | Reviewer understanding |
| Trust Boundary | Documentation + ADR |
| Attacker | N/A (misconfiguration) |
| Precondition | Confusion between layers |
| Attack | Assume ML-DSA protects Groth16 |
| Existing Mitigation | ADR-0003 explicit non-replacement |
| Residual Risk | LOW with proper docs |
| Evidence | ADR-0003, this document |

### T-PQC-003: Signature substitution across entries

| Field | Value |
|-------|-------|
| Asset | Per-entry signature binding |
| Trust Boundary | Canonical entry payload in sign/verify |
| Attacker | Manifest editor |
| Precondition | Valid signature from entry A |
| Attack | Attach signature to entry B |
| Existing Mitigation | Payload includes artifact name + sha256 |
| Residual Risk | LOW |
| Evidence | `pqc-security.test.mjs`; T-RES-002 |

---

## 5. KMS / OIDC Layer

### T-KMS-001: Stub KMS in live mode

| Field | Value |
|-------|-------|
| Asset | Live provenance trust |
| Trust Boundary | `rejectKmsStubInLiveMode()` |
| Attacker | Misconfigured CI or insider |
| Precondition | `KMS_BACKEND_MODE=live` |
| Attack | Accept `kmsStub=true` envelope |
| Existing Mitigation | VULN-001 fix; fail-closed |
| Residual Risk | LOW (code path) |
| Evidence | T-EXP-001A–B |

### T-KMS-002: Static Vault token in live mode

| Field | Value |
|-------|-------|
| Asset | OIDC ephemeral identity model |
| Trust Boundary | `vault-auth.mjs` |
| Attacker | Operator misconfiguration |
| Precondition | `VAULT_TOKEN` set in live workflow |
| Attack | Bypass OIDC with long-lived token |
| Existing Mitigation | VULN-007 fix; `VAULT_STATIC_TOKEN_FORBIDDEN_IN_LIVE_MODE` |
| Residual Risk | LOW (code path) |
| Evidence | T-EXP-007A–B |

### T-KMS-003: Missing OIDC claim bindings

| Field | Value |
|-------|-------|
| Asset | Workflow identity binding |
| Trust Boundary | `assertRequiredOidcClaimBindingsForLive()` |
| Attacker | Compromised runner with broad Vault role |
| Precondition | Live mode, unset `KMS_OIDC_EXPECT_*` |
| Attack | Authenticate from unintended workflow/repo |
| Existing Mitigation | VULN-006 fix; `OIDC_BINDINGS_REQUIRED` |
| Residual Risk | LOW (code); **NOT VERIFIED live** |
| Evidence | T-EXP-006A–F |

### T-KMS-004: Cloud HSM bypass in stub mode

| Field | Value |
|-------|-------|
| Asset | Stub/test semantics |
| Trust Boundary | `kms-signer.mjs` |
| Attacker | Test environment adversary |
| Precondition | Stub mode + cloud-hsm configured |
| Attack | Outbound HSM call exfiltrates material |
| Existing Mitigation | VULN-009 fix; `CLOUD_HSM_FORBIDDEN_IN_STUB_MODE` |
| Residual Risk | LOW |
| Evidence | T-EXP-009A–B |

### T-KMS-005: Live Vault trust chain unverified

| Field | Value |
|-------|-------|
| Asset | Production signing chain |
| Trust Boundary | GitHub OIDC → Vault → Transit |
| Attacker | External adversary |
| Precondition | Live infra provisioned |
| Attack | Full chain compromise undetected |
| Existing Mitigation | Operator checklist; smoke workflow (not PASS) |
| Residual Risk | **HIGH until operator smoke PASS** |
| Evidence | `kms-live-operator-checklist.md` — **NOT VERIFIED** |

---

## 6. TEE Layer (RESEARCH-ONLY)

### T-TEE-001: Mock evidence accepted as hardware-rooted

| Field | Value |
|-------|-------|
| Asset | Attestation trust level |
| Trust Boundary | ClaimsGate + VerificationLevel |
| Attacker | Research integrator |
| Precondition | Confusion of mock vs real |
| Attack | Treat MOCK as HARDWARE_ROOTED |
| Existing Mitigation | ADR-001; SB-01 mock/real normalizer split; VerificationLevel enum |
| Residual Risk | LOW with policy; **research only** |
| Evidence | `tee/tests/claims-gate.test.ts`; ADR-001 |

### T-TEE-002: Offline fixture passed as online attestation

| Field | Value |
|-------|-------|
| Asset | DCAP/VCEK verification integrity |
| Trust Boundary | `TEE_VERIFICATION=offline` flag |
| Attacker | Documentation reader |
| Precondition | Misread offline PoC as production |
| Attack | Deploy offline verifier without PCCS/KDS |
| Existing Mitigation | Phase 8.9B scope; FIXTURE labels |
| Residual Risk | MEDIUM if misrepresented — **NOT VERIFIED online** |
| Evidence | `phase8.9b-offline-dcap-vcek-plan.md` |

### T-TEE-003: Corrupted attestation evidence

| Field | Value |
|-------|-------|
| Asset | Evidence integrity |
| Trust Boundary | Offline verifiers / parsers |
| Attacker | Supply-chain on fixture files |
| Precondition | Tampered quote/report |
| Attack | Accept invalid attestation |
| Existing Mitigation | ECDSA verify on fixture chains; negative tests |
| Residual Risk | LOW for fixture path |
| Evidence | `tee/tests/offline-verification.test.ts`; T-RES-006 |

---

## 7. Supply Chain

### T-SC-001: Production dependency smuggling (elliptic)

| Field | Value |
|-------|-------|
| Asset | Production npm tree |
| Trust Boundary | `package.json` + `npm ls --omit=dev` |
| Attacker | Dependency confusion |
| Precondition | `circomlibjs` in production deps |
| Attack | `elliptic` vulnerable transitive dep in prod |
| Existing Mitigation | VULN-010 fix; `circomlibjs` in devDependencies |
| Residual Risk | LOW |
| Evidence | T-EXP-010A; `npm ls elliptic --omit=dev` → empty |

### T-SC-002: Migration debt binary exposure

| Field | Value |
|-------|-------|
| Asset | `production.zkey` in git |
| Trust Boundary | Allowlist + external storage target |
| Attacker | Repository cloner |
| Precondition | Public repo access |
| Attack | Obtain zkey without external storage controls |
| Existing Mitigation | Documented debt; hash pin integrity |
| Residual Risk | MEDIUM — operational |
| Evidence | `repository-boundary-report.md` (8 paths WARN) |

### T-SC-003: Lockfile drift

| Field | Value |
|-------|-------|
| Asset | Reproducible dependency graph |
| Trust Boundary | `package-lock.json` + supply-chain review |
| Attacker | Dependency update without lock sync |
| Precondition | Modified `package.json` |
| Attack | Non-reproducible build |
| Existing Mitigation | `npm ci` in CI; lock digest in supply-chain review |
| Residual Risk | LOW |
| Evidence | `benchmarks/reports/supply-chain-review.json` |

---

## 8. Release Pipeline

### T-REL-001: Unsigned release manifest

| Field | Value |
|-------|-------|
| Asset | Release artifact authenticity |
| Trust Boundary | `release.yml` KMS signing |
| Attacker | Tag pusher without Vault access |
| Precondition | Release workflow runs |
| Attack | Publish release without valid KMS signatures |
| Existing Mitigation | Workflow design requires KMS sign + verify |
| Residual Risk | **NOT VERIFIED** — operator setup pending |
| Evidence | `release.yml`; Task 4 PARTIAL |

### T-REL-002: Release metadata tampering

| Field | Value |
|-------|-------|
| Asset | Manifest `generatedAt`, `commit` fields |
| Trust Boundary | Manifest integrity checks |
| Attacker | Local manifest editor |
| Precondition | `--live` or strict verify |
| Attack | Backdated manifest metadata |
| Existing Mitigation | Regeneration overwrites; hash binding |
| Residual Risk | LOW on strict path |
| Evidence | T-RES-007 |

---

## 9. Threat Summary Matrix

| Layer | Critical threats mitigated (code) | Live NOT VERIFIED |
|-------|-----------------------------------|-------------------|
| ZK | T-ZK-001–003 | N/A |
| Provenance | T-PROV-001–003 | Local files only |
| PQC | T-PQC-001–003 | KMS signing path |
| KMS/OIDC | T-KMS-001–004 | T-KMS-005 |
| TEE | T-TEE-001–003 | All online paths |
| Supply Chain | T-SC-001–003 | External storage |
| Release | T-REL-001–002 | T-REL-001 |

---

## References

- [implementation-status-matrix.md](./implementation-status-matrix.md)
- [tee/integration/threat-model.md](../../tee/integration/threat-model.md)
- [audit-ready/threat-review-package.md](../../audit-ready/threat-review-package.md)
- [penetration-test-plan.md](../security/penetration-test-plan.md)
