# Phase 4 Production Trusted Setup — Ceremony Report

**Authorization:** PHASE 4 AUTHORIZATION received (items 1–5 AUTHORIZED;
reconstruction policy DEFERRED). Executed 2026-08-04 under the approved
conditions. Duration: 564 s. Script: `scripts/phase4_ceremony.mjs`.

## 1. Final production artifacts (hash-pinned in `specs/artifact-manifest.json`)

| Artifact | SHA-256 |
|---|---|
| `artifacts/phase4/final/production.zkey` | `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571` |
| `artifacts/phase4/final/production-vkey.json` | `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec` |
| `artifacts/phase4/final/phase4-ptau.ptau` | `4afdd19bbf8cceeb24f169b55e53fbd721de90401178489d439d0839bf218fed` |

Circuit: canonical R1CS `3d47226b06d707b1…` (verified at pre-flight), Groth16
on BN128, 6590 constraints, 30 public signals. PoT power 14 (≥ 2·6590).

## 2. Ceremony structure and per-step hashes

Powers-of-tau chain (all steps persisted under `artifacts/phase4/contributions/`,
hashes in `artifacts/phase4/hashes/hashes.json`, transcript in
`artifacts/phase4/transcripts/ceremony-transcript.log`):

| # | Step | SHA-256 |
|---|---|---|
| 0000 | pot init (new accumulator 2^14) | `6dcf0303754e8c8a…` |
| 0001 | pot contributor 1 | `4d57f58a525a09ec…` |
| 0002 | pot contributor 2 | `827bc393c0440126…` |
| 0003 | pot contributor 3 | `ff76a151bb51e24e…` |
| 0004 | pot beacon | `9adc383e18a44a65…` |
| final | preparePhase2 | `4afdd19bbf8cceeb…` |

Groth16 zkey chain (verified against canonical R1CS + ceremony ptau after
EVERY contribution; all PASS):

| # | Step | SHA-256 |
|---|---|---|
| 0000 | zkey init | `8a2cfe79adf9399e…` |
| 0001 | zkey contributor 1 (+verify PASS) | `68c2f9a9e0c21112…` |
| 0002 | zkey contributor 2 (+verify PASS) | `3e4b13130a8b1ef9…` |
| 0003 | zkey contributor 3 (+verify PASS) | `e703e2015d40fa49…` |
| 0004 | zkey beacon = FINAL production.zkey (+verify PASS) | `ce5a3d308868f2fe…` |

Beacon (record: `artifacts/phase4/beacon/beacon-record.json`): Bitcoin genesis
block hash `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f`,
2^10 iterations, applied to BOTH chains. Public and independently verifiable.

## 3. CONTRIBUTOR DISCLOSURE (read carefully)

The 3 contribution slots per chain were executed by the orchestration script
in this environment, each with fresh `crypto.randomBytes(32)` entropy that was
discarded immediately after the contribution (never persisted). This is a
structurally valid multi-contribution chain, but it does NOT provide the trust
distribution of independent human contributors on separate machines: security
here rests on the beacon plus the non-compromise of this environment's
randomness. **Recommendation:** before any mainnet-grade deployment holding
real value, independent contributors should extend the chain (any
`zkey contribute` on the final zkey remains valid), followed by a new beacon
and re-finalization; that changes the VK and requires regenerating the
verifier contract (re-authorized work).

## 4. Verification results (post-ceremony)

1. PoT chain verified (snarkjs `powersOfTau.verify`, beacon-topped): PASS.
2. Final zkey verified against canonical R1CS + ceremony ptau: PASS.
3. Production vkey: groth16, nPublic=30, IC=31; hash `d012bd29…`.
4. Dev/production separation: no dev hash (`c80f004e…`, `b4f1f3dd…`,
   `6193351a…`) appears in any phase4 artifact: PASS.
5. `scripts/gen_verifier_production.mjs` guards (zkey hash vs ceremony record,
   dev separation, vkey re-export byte-match): PASS →
   `contracts/Groth16VerifierV2Production.sol` (19069 bytes), compiled.
6. `scripts/phase4_verify_production.mjs`: production proof from canonical
   witness; 30-signal layout PASS; snarkjs verify PASS; tamper reject PASS;
   contract IC constants == vkey IC (31/31) PASS.
7. `test/Groth16VerifierV2Production.ts` (on-chain, Hardhat 3): **5/5 PASS** —
   including **DEV baseline proof REJECTED by the production verifier**.
8. Standalone gates re-run with production contract in tree: 42/42 PASS.
9. Manifest verification: 28/28 PASS (Phase 0 10/10 unchanged, SSoT, phase2,
   evidence, phase4 final hashes + records + separation).

## 5. Abort-condition record

Two pre-ceremony execution attempts ABORTED cleanly before any contribution
was made (missing `logger.debug`; unexported `snarkjs/package.json` subpath).
Abort handling worked as designed: partial namespaces were removed and the
ceremony restarted from scratch. No contribution, beacon, or final artifact
from an aborted run was reused. During the successful run, zero abort
conditions occurred.

## 6. Condition compliance

| Condition | Status |
|---|---|
| Canonical verified R1CS used | PASS (pre-flight hash check in ceremony script) |
| Dev zkey/vkey never promoted | PASS (hash guards in ceremony + generator + manifest) |
| Verifier contract generated only after VK finalized | PASS (separate post-ceremony step) |
| Transcripts/hashes/beacon/final persisted under artifacts/phase4/ | PASS |
| Phase 0–3 artifacts immutable | PASS (manifest 28/28; Phase 0 10/10) |
| Abort conditions stop immediately | PASS (exercised twice pre-ceremony) |

## 7. What is NOT done (requires further authorization)

- **Deployment** of `Groth16VerifierV2Production` / a production
  `AegisShieldV2` to any network (none authorized; no target chain chosen).
- Ceremony extension by independent human contributors (§3 recommendation).
- v2 `.circom` reconstruction (policy DEFERRED by Phase 4 authorization).
