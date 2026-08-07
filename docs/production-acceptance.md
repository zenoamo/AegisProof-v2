# Production Acceptance Criteria

**Purpose:** Stakeholder sign-off checklist before considering Phase 5 delivery complete.

---

## Technical Criteria

- [ ] Manifest verification passes: `node scripts/verify_manifest.mjs` → 28/28 PASS
- [ ] CI gates pass: `node scripts/gates/run_all.mjs` → 42/42 PASS
- [ ] On-chain verifier test passes: `test/Groth16VerifierV2Production.ts` → 5/5 PASS
- [ ] Dev vs production separation confirmed (no dev hash in phase4 outputs)
- [ ] IC constants count = 31, all on-curve (Groth16 BN128)
- [ ] Protocol version enforced: `SUPPORTED_PROTOCOL_VERSION = 2`
- [ ] Timestamp window enforced: MAX_AGE=86400s, SKEW=300s

---

## Documentation Criteria

- [ ] Architecture doc updated with deployment topology
- [ ] Getting started guide provides working local flow
- [ ] Deployment guide covers local/sepolia/mainnet (docs-only)
- [ ] Security/threat models reviewed and approved
- [ ] Operational docs complete (checklist, incident-response, key-management)
- [ ] FAQ addresses common questions

---

## SDK Criteria

- [ ] TypeScript package builds successfully (`npm run build` in `packages/sdk`)
- [ ] Pack dry-run succeeds (`npm pack --dry-run`)
- [ ] Types exported without errors
- [ ] README installed with basic usage examples
- [ ] Unit tests stubbed (at minimum smoke tests pass)

---

## Examples Criteria

- [ ] Local verifier example works offline
- [ ] Browser verifier bundles VK and verifies proof
- [ ] Contract interaction example compiles and runs locally
- [ ] Proof generation workflow reproducible
- [ ] No secrets committed to examples repository

---

## Operational Readiness Criteria

- [ ] Deployment checklist populated
- [ ] Incident response template available
- [ ] Key management policy documented
- [ ] Ceremony verification guide tested
- [ ] Emergency disable procedure defined

---

## Security & Compliance Criteria

- [ ] No public chain deployments performed (authorized scope: docs only)
- [ ] All secret keys excluded from repository
- [ ] Private keys use HSM/MPC where feasible
- [ ] Logging policy implemented for operator actions
- [ ] Audit trail maintained for all sensitive operations

---

## Sign-Off Required From

| Role | Signature | Date | Notes |
|---|---|---|---|
| Technical Lead | _________ | _________ | ____________ |
| Security Reviewer | _________ | _________ | ____________ |
| Operations Lead | _________ | _________ | ____________ |
| Business Sponsor | _________ | _________ | ____________ |

---

## Notes

- Signing off confirms readiness; it does **not** authorize immediate production deployment.
- Any outstanding items must be documented with owners and target dates.
- Schedule a post-signoff review within 30 days of first live activity.
