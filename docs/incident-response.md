# AegisProof Incident Response Guide

**Severity levels:**
- **Severity 1 (Critical):** Immediate action required (minutes to hours)
- **Severity 2 (Moderate):** Scheduled hotfix window (24–48 hours)
- **Severity 3 (Low):** Backlog item (future sprints)

---

## Incident Taxonomy

### Severity 1 (Critical)

**Examples:**
- Private key compromise (operator or signer keys)
- Vulnerability in production verifier logic (IC mismatch discovered post-deploy)
- Protocol-level replay attack successfully exploited
- Trusted setup material leakage (dev zkey exposed as "production")

**Response:**
1. Immediate notification to all stakeholders via emergency channel
2. Suspend session registration immediately if replay suspected
3. Draft public advisory if user funds/data at risk
4. Prepare emergency disable procedure for Shield
5. Initiate post-mortem within 24 hours

### Severity 2 (Moderate)

**Examples:**
- Gas estimation off by >10% causing frequent failures
- Timestamp window misconfiguration detected
- SDK API changes breaking client applications
- Non-critical circuit inefficiencies discovered

**Response:**
1. On-call rotation notified within 2 hours
2. Hotfix plan drafted within 24 hours
3. Scheduled deployment window communicated
4. Post-incident review within 48 hours

### Severity 3 (Low)

**Examples:**
- Documentation inaccuracies
- Minor SDK usability improvements needed
- Non-production infrastructure performance issues

**Response:**
1. Backlog item queued
2. No emergency procedures triggered

---

## Communication Template (Severity 1)

```
[EMERGENCY] AegisProof Security Advisory

Incident Type: <brief description>
Severity: Critical (S1)
Timeline: <detected time>, <current status>
Affected Systems: <list networks/contracts>

Immediate Actions Required:
- Operator key rotation if compromised
- Session registry suspension if replay confirmed
- Public advisory pending investigation

Contact: <emergency contact email/slack channel>
Update Frequency: Every 2 hours until resolved
```

---

## Emergency Disable Procedure

Only authorized operators may execute:

1. Call emergency meeting (all stakeholders)
2. Execute `setPurposeAllowed(purposeId, false)` or full deactivation via multi-sig
3. Log all actions taken with timestamps
4. Notify users via official channels
5. Begin post-mortem process

---

## Post-Incident Review

All incidents require a written report containing:
- Timeline of events
- Root cause analysis
- Impact assessment
- Mitigation measures implemented
- Prevention recommendations
- Action items with owners and deadlines
