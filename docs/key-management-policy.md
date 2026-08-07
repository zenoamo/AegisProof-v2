# AegisProof Key Management Policy

**Purpose:** Secure handling of cryptographic keys throughout their lifecycle.  
**Scope:** Operator keys, deployment signers, and wallet accounts used for deployments.

---

## Key Categories

### Operator Keys

Used for:
- Registering sessions via `registerSession()`
- Deactivating sessions via `deactivateSession()`
- Managing purpose allowances (`setPurposeAllowed()`)

**Requirements:**
- Hardware-backed signing (HSM) or MPC preferred
- Minimum 2-of-3 multi-sig for critical operations (optional but recommended)
- Rotation every 90 days or sooner upon compromise risk
- Logging of all actions taken (who, when, what, why)

### Deployment Signers

Used for:
- Deploying verifier/shield contracts
- Upgrading system components (only if explicitly authorized)

**Requirements:**
- Cold storage preferred for mainnet deployments
- Air-gapped signing environment
- Multi-signature approval workflow (minimum 3 signers, 2 approvals)

---

## Lifecycle Management

### Generation
- Use cryptographically secure RNG (standard library `crypto.randomBytes` acceptable for local dev)
- Never hardcode keys in source code
- Store keys in vault/secret manager, not in plaintext files

### Storage
- Production: HSM or approved key management service
- Development: Environment variables only (`.env` never committed)
- Backup: Encrypted backup copies stored securely offline

### Rotation
- Scheduled rotation every 90 days for operator keys
- Immediate rotation upon any suspicion of compromise
- Coordinate rotations during low-traffic windows
- Announce planned maintenance windows

### Retirement
- Archive old keys securely for audit trail (encrypted)
- Update all systems referencing retired keys
- Remove references from configuration files
- Document retirement reason and date

---

## Emergency Procedures

See [`incident-response.md`](./incident-response.md). Key points:

- **Key compromise**: immediate rotation; revoke all dependent permissions
- **Signer loss**: implement multi-sig recovery process if pre-configured
- **Secret exposure**: rotate associated keys and revoke affected sessions

---

## Audit Requirements

- Quarterly key inventory review
- Annual third-party security audit of key management practices
- Post-incident audits after any Severity 1+ event
- Log retention: minimum 2 years
