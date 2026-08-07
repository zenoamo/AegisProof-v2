# Task Definition: v2 `.circom` Source Reconstruction

**Status:** DEFINITION ONLY — this document does **not** authorize any work. Execution requires separate, explicit human review and approval. Opened under Phase 3 scope item #11; approved as a task definition, not as implementation.

## 1. Background

The v2 circuit source (`aegis_commit_core_v2.circom`) was lost before Phase 2.
The compiled artifacts survived and were frozen as CANONICAL ground truth
(hash-pinned in `artifacts/phase2/cache/cache-manifest.json` and verified by
`node scripts/verify_manifest.mjs`):

| Artifact | Hash (prefix) |
|---|---|
| `artifacts/phase2/r1cs/aegis_commit_core_v2.r1cs` | `3d47226b…` |
| `artifacts/phase2/r1cs/aegis_commit_core_v2.sym` | `3aea81b1…` |
| `artifacts/phase2/r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm` | `a0d3c53f…` |

Circuit characteristics (measured, C-1/C-4 verified): 30 public signals in
SSoT order (wires 1..30), 2 private wires (31=secretKey, 32=deviceId),
0 outputs (input-flip), Poseidon(6) commitment, Poseidon(8) nullifier with
`DOMAIN_NULLIFIER_V2`, timestamp unconstrained by design.

## 2. Goal

Produce a `.circom` source whose compilation reproduces the canonical
artifacts closely enough to restore a maintained source of truth — WITHOUT
weakening or altering the trust status of the existing canonical binaries.

## 3. Explicit NON-goals (hard boundaries)

1. **No replacement of canonical artifacts.** The frozen r1cs/sym/wasm remain
   the pinned ground truth regardless of reconstruction outcome.
2. **No trusted setup of any kind.** Production setup remains Phase 4.
3. **No modification of Phase 0 artifacts** (all 10 hash-pinned files).
4. **No re-derivation of the dev zkey as a substitute for the pinned one.**
5. No changes to `specs/aegis-protocol.v2.json` (SSoT is frozen input here).

## 4. Inputs available to the reconstruction

- Canonical r1cs / sym / wasm above (read-only).
- `specs/aegis-protocol.v2.json` (signal names, order, hash specs, bindings).
- v1 source `circuits/aegis_commit_core.circom` (structural reference only —
  v2 differs materially: 30 signals, domain-separated nullifier, input-flip).
- Witness behavior: any candidate circuit can be probed via the wasm witness
  calculator against the frozen test vectors (`artifacts/phase2/tests/`).

## 5. Equivalence criteria (proposed; to be approved at review)

Strict byte-equality of recompiled r1cs/wasm against the canonical files is
UNLIKELY (compiler version, optimization order, unused-wire elimination) and
is NOT required. Proposed graded criteria:

- **E1 (structural):** recompiled r1cs has identical nConstraints, nPubInputs=30,
  nPrvInputs=2, nOutputs=0, and identical `.sym` public-wire mapping.
- **E2 (behavioral):** witness equivalence over a test battery — baseline +
  the 3 negative vectors + randomized fuzz inputs; candidate witness must
  match canonical wasm witness on all public wires and on commitment/nullifier
  wires; negative vectors must fail identically.
- **E3 (constraint-level, strongest):** constraint-by-constraint comparison of
  the R1CS A/B/C matrices after canonical wire renumbering; any unexplained
  delta is a STOP condition.

Acceptance threshold (to be decided at review): E1+E2 minimum; E3 preferred.

## 6. Deliverables (upon approval)

1. `circuits/aegis_commit_core_v2.circom` (candidate source) + build script.
2. Equivalence report against §5 criteria, machine-checkable, persisted under
   `artifacts/phase2/reports/` as its own mode-separated evidence file.
3. A CI gate asserting the accepted equivalence level on every change to the
   candidate source.
4. Updated retention classification: candidate source marked RECONSTRUCTED
   (canonical binaries remain CANONICAL — see `docs/artifact-retention.md`).

## 7. Process requirements

- Separate review session: criteria (§5) approved BEFORE implementation.
- The reconstruction MUST run the existing gate suite + verification suite
  (FAST) before and after; Phase 0 hashes must remain identical (suite checks
  this automatically).
- Any failure during equivalence testing is reported, never treated as
  success, never silently relaxed.

## 8. Open questions for the review

1. Is circom compiler version recovery feasible from the wasm/r1cs provenance
   (needed to judge byte-equality prospects)?
2. Accept E1+E2 only, or require E3?
3. If reconstruction FAILS E-criteria: accept "no source available" and keep
   binaries as permanent ground truth, or retry with alternative tooling?
