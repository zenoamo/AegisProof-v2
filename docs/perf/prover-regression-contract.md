# Prover Security Regression Contract (Phase 8.11)

**Status:** Mandatory for all Phase 8.11+ changes touching `scripts/`, `benchmarks/`, or prover CI.

**Command:** `npm run test:prover-compat`

**Frozen invariants:** circuit, R1CS, trusted setup, `production.zkey`, VK, `Groth16VerifierV2Production.sol` (canonical), publicSignals layout (30), `protocol/`, `packages/sdk/`, `tee/`, ADR-001.

---

## Regression Gates

| ID | Gate | Description | Required |
|----|------|-------------|----------|
| **T1** | snarkjs proof verify | snarkjs-generated proof verifies with snarkjs `groth16.verify` | **Always** |
| **T2** | rapidsnark proof verify | rapidsnark-generated proof verifies with snarkjs | When binary available |
| **T3** | snarkjs on-chain verify | snarkjs proof accepted by `Groth16VerifierV2Production` | **Always** |
| **T4** | rapidsnark on-chain verify | rapidsnark proof accepted on-chain | When binary available |
| **T5** | publicSignals 30 match | Output length 30; values match production baseline | **Always** |
| **T6** | zkey hash | `production.zkey` SHA-256 matches pinned constant | **Always** |
| **T7** | VK hash | Ceremony-format vkey hash matches pinned constant | **Always** |
| **T8** | tamper reject | Tampered commitment/proof rejected (snarkjs + on-chain) | **Always** |
| **T9** | artifact integrity | Benchmark runner output schema valid; artifact hashes present | **Always** |

---

## Pinned Hashes

| Artifact | SHA-256 |
|----------|---------|
| production.zkey | `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571` |
| production-vkey (ceremony JSON) | `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec` |
| v2 wasm | `a0d3c53f3cdce624d5140874f0884b6b8075e701539978bdd55a826e41db60bd` |

Constants: `scripts/lib/resolve-artifacts.mjs` (`PRODUCTION_ZKEY_HASH`, `PRODUCTION_VKEY_HASH`).

---

## CI Policy

### `prover-compatibility` (PR / push)

1. `artifactsReady()` — **FAIL** if missing (no silent skip)
2. Hardhat compile (isolated prover config)
3. `npm run test:prover-compat` — T1–T9
4. `npm run check:bench-drift` — warn-only (initial Phase 8.11)

### `prover-benchmark` (weekly / manual)

1. Optional rapidsnark install + `evaluate:rapidsnark`
2. `npm run bench:prover -- --samples 20`
3. `npm run check:bench-drift` — warn-only
4. Upload benchmark artifacts

### rapidsnark (optional backend)

- T2/T4 SKIP when binary absent — job continues
- Does not affect snarkjs path soundness

---

## Benchmark Drift Contract

**Baseline SSoT:** `benchmarks/reports/baseline.json` (schemaVersion 2)

**Compare:** latest `benchmarks/reports/prover-bench-*.json`

**Modes:** M2 (witness), M3 (snarkjs prove), M4 (rapidsnark prove)

| Threshold | p50 vs baseline |
|-----------|-----------------|
| PASS | ≤ +30% |
| WARN | +30% – +50% |
| FAIL | > +50% |

**Enforcement:** `--enforce` or `BENCH_DRIFT_ENFORCE=1` (future CI hard gate)

---

## Artifact Resolution Contract

**Single resolver:** `scripts/lib/resolve-artifacts.mjs` → `resolveArtifacts()`

All prover, verifier, benchmark, and compatibility scripts **MUST** resolve artifact paths through this module.

### Profiles

| Profile | Use case | zkey / vkey |
|---------|----------|-------------|
| `prover` (default) | Canonical prove / bench / T1–T9 | production |
| `phase2` | `phase2_verify.mjs` dev suite | dev setup |
| `production` | `phase4_verify_production.mjs` | production + hash assert |

### Startup log

```
[artifact-resolver] source=artifacts/phase2 profile=phase2
```

JSON summary (`--artifact-json`):

```json
{
  "source": "crypto-artifacts",
  "profile": "production",
  "wasmHash": "...",
  "zkeyHash": "...",
  "vkHash": "..."
}
```

### Forbidden

- Hardcoded `artifacts/phase2/...` or `artifacts/phase4/...` paths in scripts
- Alternate zkey lookup bypassing pinned hash checks
- Skipping hash verification for production artifacts

### Resolution tests

`npm run test:artifact-resolution` — Cases 1–4 (canonical, fallback, missing fail-closed, hash mismatch fail-closed)

---

## Change Control

Any change affecting T1–T9 or pinned hashes requires **Architecture Review**.

Allowed without protocol review: `scripts/`, `benchmarks/`, CI, `docs/perf/`.

Forbidden without Architecture Review: circuits, zkey, VK, verifier contract, publicSignals layout, `protocol/`, SDK, TEE layer.

---

## References

- `tests/prover-compatibility.test.ts`
- `scripts/check-bench-drift.mjs`
- `benchmarks/reports/baseline.json`
- `docs/perf/prover-benchmark-baseline.md`
