# Phase 4 Pre-Ceremony Readiness Report & Ceremony Plan

**Status: `BLOCKED — AWAITING HUMAN AUTHORIZATION`**

No production trusted setup has been performed. No production zkey or verification key exists. This document is a planning and readiness artifact only, generated under the Phase 4 review authorization (read-only inspection, hash verification, artifact inventory, ceremony plan generation).

Generated: 2026-08-04 · Commit pinned: `52771c6` · Working tree: clean.

---

## 1. Current state confirmation (re-verified, read-only)

| Item | Result |
|---|---|
| Phase 0 immutable artifacts | **10/10 SHA-256 match** (`node scripts/verify_manifest.mjs`) |
| Phase 1 SSoT (`specs/aegis-protocol.v2.json`) | hash `90f7a6a0ee640f7c…` — verified |
| Phase 2 FULL evidence | **41/41 PASS** (`phase2_evidence_full.json`) |
| Phase 2 FAST evidence | **30/30 PASS** (`phase2_evidence_fast.json`) |
| Artifact manifest verification | **20/20 PASS** |
| Phase 3 standalone gates | **42/42 PASS** (layout 9, binding 4, icvk 7, domain 11, hardcode 11) |
| Contract tests (AegisShieldV2) | **12/12 PASS** (Phase 3 evidence; contracts unchanged since) |
| SSoT codegen determinism | verified (regen → zero diff, TS + Solidity) |
| Git state | working tree clean; policy-C commit `52771c6` pinned |
| Production trusted setup | **NOT performed** |
| Production VK | **does not exist** |
| Dev zkey/vkey | dev-labeled, Git-excluded, **forbidden for production use** |
| Phase 0 modifications | none (suite enforces before/after hash equality) |

Dev setup material present locally (never committed):
`artifacts/phase2/setup/aegis_v2_0000.zkey` (hash `c80f004e9f6b26fa…`) +
`pot10_final.ptau` (`b4f1f3dd3222cdfd…`), single-contribution, random
entropy — explicitly NOT a production setup.

## 2. Pre-ceremony validation (§3 of the Phase 4 review)

### Circuit (canonical, source lost — binaries are ground truth)
| Check | Value |
|---|---|
| R1CS hash | `3d47226b06d707b1…` PASS |
| Constraint count | nConstraints = **6590** |
| Public signal count | nPubInputs = **30** |
| Private wires | nPrvInputs = 2 (secretKey, deviceId) |
| Outputs | nOutputs = 0 (input-flip) |
| IC length | **31** (= nPublic + 1) PASS |
| Protocol version | 2 PASS |
| SSoT hash | `90f7a6a0ee640f7c…` PASS |

### Verification key (committed dev vkey — for pipeline validation only)
| Check | Result |
|---|---|
| Protocol = groth16, nPublic = 30 | PASS |
| IC points on BN128 (31 points) | PASS |
| Alpha (G1) / Beta (G2) / Delta (G2) on-curve | PASS |
| Public signal alignment (SSoT order) | PASS |
| Hash | `6193351af0892493…` |

NOTE: this vkey derives from the DEV zkey. The production ceremony produces a
NEW verification key; the committed vkey must never be promoted.

### Protocol (SSoT, frozen)
| Check | Value |
|---|---|
| Canonical 30-signal layout (wires 1..30) | PASS (C-1, measured witness) |
| chainId binding | signal 22, contract-enforced vs `block.chainid`; nullifier input |
| Session binding | sessionId in nullifier (Option A), contract session registry |
| Commitment | Poseidon(6) PASS |
| Nullifier | Poseidon(8) with DOMAIN_NULLIFIER_V2 PASS |
| NUS domain | computed == SSoT constant PASS |
| Timestamp exclusion | binding "none (untrusted metadata)"; contract window only PASS |
| MAX_AGE | 86400 s PASS |
| CLOCK_SKEW | 300 s PASS |
| DEPLOYMENT_DOMAIN policy | `keccak256("AEGIS_SHIELD_V2")` in AegisShieldV2 PASS |

### Contracts
| Check | Result |
|---|---|
| `contracts/AegisShieldV2.sol` | implemented per SSoT contractPolicy; dev banner |
| `contracts/Groth16VerifierV2.sol` | dev-labeled; `verifyProof(..., uint[30])`; nPublic=30 |
| Contract/VK signal alignment | uint[30] everywhere (shield, verifier interface, IC length 31) |
| Contract/SSoT alignment | all constants via generated `AegisSignals.sol` (codegen from SSoT) |

IMPORTANT: both v2 contracts currently pair with the DEV verification key.
After the ceremony, a PRODUCTION verifier contract must be generated from the
production zkey and a new shield deployment (or constructor-pinned VK) must
reference it. The current contracts are NOT production-deployable.

## 3. v2 .circom reconstruction status (§4)

- **Task status:** DEFINITION ONLY — `docs/v2-circom-reconstruction-task.md`.
  No implementation started; awaiting separate human review.
- **E1 (structural):** identical nConstraints/nPubInputs=30/nPrvInputs=2/
  nOutputs=0 + identical `.sym` public-wire mapping.
- **E2 (behavioral):** witness equivalence vs canonical wasm over baseline +
  3 negative vectors + fuzz battery; negatives must fail identically.
- **E3 (constraint-level):** R1CS A/B/C matrix comparison after canonical
  wire renumbering; unexplained delta = STOP.
- **Required for production setup?** **NO.** The ceremony consumes the
  canonical R1CS directly; circom source is not an input to trusted setup.
  Reconstruction is a maintainability task, independent of and parallel-safe
  with Phase 4 (its non-goals forbid touching setup).
- **Relation to current policy:** frozen R1CS/WASM/SYM remain CANONICAL
  ground truth regardless of reconstruction outcome (§3 non-goal 1 of the
  task doc). A reconstructed source may never replace or re-derive the
  canonical binaries' trust status.

## 4. Ceremony plan (executed ONLY after explicit AUTHORIZATION)

### 4.1 Policy (Phase 1 approved)
Multi-contributor sequential ceremony + final beacon contribution, on the
canonical R1CS (`3d47226b…`), Groth16, BN128. Power-of-tau: fresh ceremony
ptau of power ≥ 14 (2·6590 = 13180 domain points; 2^14 = 16384).

### 4.2 Artifact namespace (never touches Phase 0–3 artifacts)
```text
artifacts/phase4/
  ceremony/        ceremony metadata (participants, ordering, schedule, tools)
  contributions/   per-contributor zkey files, numbered 0001..NNNN
  transcripts/     per-contribution verification transcripts
  hashes/          SHA-256 records: before/after hash per contribution
  beacon/          beacon input (e.g. block hash), beacon contribution, derivation record
  final/
    production.zkey          FINAL production proving key
    production-vkey.json     FINAL production verification key
  reports/         ceremony summary report + independent verification results
```
Existing Phase 0–3 artifacts are NEVER overwritten; `artifacts/phase4/` is a
disjoint namespace. Git policy C will be extended to track transcripts/hashes/
final-vkey (text, small) and EXCLUDE `production.zkey` and raw contributions
(large; distributed out-of-band with recorded SHA-256).

### 4.3 Security requirements (mandatory, each = abort condition if missing)
1. Contribution ORDER recorded (monotonic sequence numbers).
2. Contributor IDENTIFIER recorded per contribution (pseudonym OK, stable).
3. SHA-256 hash BEFORE and AFTER every contribution.
4. Full transcript per contribution saved (snarkjs `zkey verify` against
   canonical R1CS + running ptau chain).
5. Beacon INPUT (exact source + retrieval evidence) and OUTPUT saved.
6. Final zkey hash recorded and cross-referenced.
7. Final verification key hash recorded (exported deterministically from
   final zkey; this is the key the production verifier contract embeds).
8. Ceremony metadata (tool versions, machine class, durations) saved.
9. Zero mixing of production and dev artifacts (separate dirs, separate
   hashes; gates assert no dev hash appears in phase4 records).
10. Phase 0 artifacts untouched (manifest re-verified before AND after).

### 4.4 Ceremony sequence (post-authorization)
1. Pre-flight: re-run `verify_manifest.mjs` (20/20) + gates (42/42); record.
2. `powers of tau` new (power 14) → contributions → beacon → preparePhase2.
3. `zkey new` (canonical R1CS + ceremony ptau) → contributor sequence →
   beacon contribution → `zkey verify` at every step.
4. Export production vkey; hash; independent verification of the full chain.
5. Generate PRODUCTION verifier contract from production zkey (new file,
   dev contract untouched); compile; contract/vkey alignment gate.
6. Write ceremony report; manifest re-check; commit evidence under policy C.

### 4.5 Abort conditions (any → immediate STOP, never treated as success)
R1CS hash mismatch · SSoT hash mismatch · public signal count mismatch ·
IC length mismatch · VK alignment mismatch · contract/VK mismatch ·
unexpected artifact modification · Phase 0 hash mismatch · missing ceremony
transcript · contribution hash mismatch · beacon verification failure ·
prod/dev artifact mixing · unexpected Git working-tree modification.

## 5. Authorization gate (§8) — NOTHING below is approved yet

```text
PHASE 4 AUTHORIZATION

1. Pre-Ceremony Validation: APPROVE / REJECT
2. v2 Circuit Reconstruction Policy: APPROVE / DEFER / REJECT
3. Trusted Setup: Multi-Contributor + Beacon
4. Production Artifact Namespace: artifacts/phase4/
5. Production Trusted Setup Authorization: AUTHORIZED / BLOCKED
```

Until item 5 explicitly reads `AUTHORIZED`, status remains:
**`BLOCKED — AWAITING HUMAN AUTHORIZATION`**. Do not self-authorize.
