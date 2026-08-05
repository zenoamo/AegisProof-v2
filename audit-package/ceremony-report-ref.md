# Ceremony Report Reference

**Pointer to:** [`docs/phase4-ceremony-report.md`](../docs/phase4-ceremony-report.md)

---

## Key Information from Ceremony Report

### Final Hashes

| Artifact | SHA-256 Hash |
|---|---|
| production.zkey | `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571` |
| production-vkey.json | `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec` |
| phase4-ptau.ptau | `4afdd19bbf8cceeb24f169b55e53fbd721de90401178489d439d0839bf218fed` |

### Beacon Specification

- **Source:** Bitcoin genesis block hash
- **Hash:** `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f`
- **Iterations:** 2^10 per contribution
- **Applied to:** Both Powers-of-Tau chain and Groth16 zkey chain

### Contribution Disclosure

The 3 contribution slots were executed in a single environment with orchestrated random entropy (not independent human contributors). This produces structurally valid artifacts verified at every step, but **independent human contributions are recommended before mainnet-grade deployments** holding significant value. Any additional contribution extending the chain remains valid and will produce a new VK requiring verifier contract regeneration.

---

## Verification Results from Ceremony

All checks passed:
- ✓ Powers-of-Tau verify after each contribution
- ✓ ZKey.verifyFromR1cs passes after each contribution
- ✓ Beacon applied successfully to both chains
- ✓ Final verifyFromR1cs confirms IC integrity
- ✓ VKey export shape validated (Groth16, 30 signals, 31 IC points)
- ✓ Dev vs production separation confirmed (no dev hash prefixes in phase4 output)

Full transcript available in `artifacts/phase4/transcripts/ceremony-transcript.log`.

---

## Action Required Before Production Use

Stakeholders should review:
1. Full ceremony report (above link)
2. Independent contribution extension (recommended)
3. Operator key management policy ([`docs/key-management-policy.md`](../docs/key-management-policy.md))
4. Incident response procedures ([`docs/incident-response.md`](../docs/incident-response.md))
