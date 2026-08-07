# AegisProof v2 - Operational Monitoring Guide

**Document Version:** 1.0  
**Date:** August 2026 (Phase 7)  
**Purpose:** Contract health & proof verification observability  

---

## Executive Summary

This guide defines a monitoring framework for operational visibility into deployed AegisProof infrastructure, capturing key performance indicators and enabling rapid anomaly detection and proactive incident response.

### Metrics Taxonomy

Monitor four primary categories continuously:

1. **Contract Health:** Deployment status gas consumption event emissions
2. **Proof Verification:** Success rates latency distributions error patterns
3. **Session Management:** Registration volume expiration timelines nullifier activity
4. **Network Performance:** RPC endpoint reliability block propagation times finality assurance

---

## 1. Contract Health Metrics

### Primary Indicators

| Metric | Target | Alert Threshold | Measurement Method |
|---|---|---|---|
| Uptime | ≥99.9% | <99.5% for >1 hour | Health check endpoint polling |
| Gas Usage (verifyProof) | ~285k gas | >±10% deviation from estimate | Block explorer receipt analysis |
| Event Emission Rate | Continuous | >5 min gap between events | The Graph subgraph query |
| Storage Slot Accesses | Minimal | Unusual spike (>2x baseline) | Tenderly transaction simulation |

---

### Dashboard Queries (Tenderly API Examples)

**Verify Function Call Success Rate:**
```javascript
GET /api/v1/networks/{networkId}/contracts/{address}/calls?success=true&timeframe=24h
```
Expected: ≥95% success rate; investigate dips below 90%.

**Gas Consumption Trend:**
```javascript
GET /api/v1/networks/{networkId}/contracts/{address}/gas?aggregation=hourly
```
Plot moving average comparing against historical baseline detecting anomalies.

---

## 2. Proof Verification Metrics

### Key Performance Indicators

| KPI | Ideal Value | Warning Level | Critical Level |
|---|---|---|---|
| Success Rate | >99% | 95-99% | <95% |
| Average Latency | <50ms off-chain | 50-100ms | >100ms |
| Rejection Reasons (Invalid Signature) | <1% of attempts | 1-5% | >5% |
| Rejection Reasons (Expired Timestamp) | <5% of attempts | 5-10% | >10% |

---

### Visualization Example (Grafana Panel)

```json
{
  "panel_title": "Verification Success Rate (24h)",
  "query": "rate(aegisproof_verification_success[5m]) * 100",
  "threshold_low": 90,
  "threshold_high": 99,
  "alert_on_deviation": true
}
```

Track rejection reasons distribution pie chart highlighting primary failure modes guiding root cause remediation efforts.

---

## 3. Session Metrics

### Tracking Dimensions

| Dimension | Description | Data Retention Period |
|---|---|---|
| Active Sessions | Current valid session count | 30 days rolling window |
| New Registrations Per Hour | Volume trend indicator | 90 days |
| Average Session Lifetime | Duration until expiration/deactivation | 1 year |
| Nullifier Collision Count | Duplicate submission attempts | Permanent audit log |

---

### Operational Reports

**Daily Summary Email:**
```
Subject: AegisProof Daily Operations Report — YYYY-MM-DD

Active sessions: 1,234 (+5% vs yesterday)
New registrations: 89 (average: 85 ±12)
Expired sessions: 156 (normal decay pattern)
Nullifier collisions detected: 2 (investigate source IPs)
Peak concurrency: 1,456 at 14:32 UTC
```

Generate automatically via cron job, querying the blockchain indexer, aggregating statistics, and distributing over a secure encrypted channel.

---

## 4. Nullifier Usage Statistics

### Abuse Detection Signals

Anomalies potentially indicating attack vectors or system misconfiguration:

| Signal | Pattern | Response Action |
|---|---|---|
| Rapid Nullifier Generation | >100/min from single IP | Rate limit temporarily ban IP |
| Sequential Session IDs | Predictable numbering scheme | Investigate client-side randomness implementation |
| Cross-Chain Replay Attempts | Same proof submitted multiple chains | Implement namespace prefixing enforcement |
| Nullifier Registry Bloat | Exceeding expected growth rate | Schedule pruning cycle maintenance window |

---

### Analytics Queries

**Top Devices by Submission Count (Last 24 Hours):**
```sql
SELECT device_id, COUNT(*) as submissions 
FROM nullifiers 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY device_id 
ORDER BY submissions DESC 
LIMIT 10;
```

Review weekly identifying outliers requiring manual investigation customer outreach.

---

## 5. Gas Usage Tracking

### Cost Optimization Opportunities

Monitor gas expenditure identifying inefficiencies opportunities reducing operational overhead:

| Optimization Area | Current Cost | Potential Savings | Effort Required |
|---|---|---|---|
| Batch Verify (not implemented) | N/A | ~30% reduction per proof | High (requires circuit modification) |
| Calldata Compression | 1,216 bytes/tx | ~15% saving via binary encoding | Medium (SDK update required) |
| Off-Chain Simulation Before Tx | Variable | Avoid wasted gas on reverted calls | Low (add validation layer) |

---

### Budget Forecasting Model

Predict monthly costs based on projected transaction volumes:

```
Estimated Monthly Gas Cost = (Avg Verifications/Hour × 24 × 30) × AvgGasPerTx × GasPrice
                            = (1,000 × 24 × 30) × 285,000 × $0.000000002
                            = $2,052/month @ current ETH price $2,500/gas
```

Adjust assumptions quarterly incorporating real measured data improving accuracy forecasting reliability.

---

## 6. Alert Configuration

### Severity Classification

| Level | Definition | Response Time | Notification Channel |
|---|---|---|---|
| P0 (Critical) | Service outage security breach | Immediate (<15 min) | SMS + Phone call + Slack |
| P1 (High) | Significant degradation | <1 hour | Slack + Email |
| P2 (Medium) | Minor issues impacting UX | <4 business hours | Email ticketing system |
| P3 (Low) | Informational cosmetic | Next business day | Ticket only no notification |

---

### Sample Alert Rules (Prometheus Syntax)

```yaml
# P0: Contract unresponsive
- alert: ContractUnresponsive
  expr: up{job="aegisproof-verifier"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "AegisProof verifier contract unreachable"
    runbook_url: "https://wiki.internal/aegisproof-p0-response"

# P1: High rejection rate
- alert: HighVerificationRejectionRate
  expr: rate(verification_rejections_total[5m]) / rate(verification_attempts_total[5m]) > 0.1
  for: 10m
  labels:
    severity: high
  annotations:
    summary: "Verification rejection rate exceeds 10% threshold"
    runbook_url: "https://wiki.internal/aegisproof-p1-response"

# P2: Unusual gas consumption
- alert: AbnormalGasUsage
  expr: change(gas_used_total[1h]) > 1.5 * avg(gas_used_total[1h] offset 1d)
  for: 15m
  labels:
    severity: medium
  annotations:
    summary: "Gas consumption increased 50% above daily average"
    runbook_url: "https://wiki.internal/aegisproof-p2-response"
```

Configure PagerDuty/OpsGenie integration ensuring right people notified promptly appropriate severity levels.

---

## 7. Operational Dashboards

### Recommended Tools Stack

| Purpose | Tool | Cost | Setup Complexity |
|---|---|---|---|
| Real-time Metrics | Datadog/New Relic | $$$ | Medium |
| Blockchain Indexing | The Graph/Dune Analytics | Free tier available | Low-Medium |
| Custom Grafana Panels | Self-hosted Prometheus+Grafana | Free | High initial setup low maintenance |
| Log Aggregation | ELK Stack/Loki | $$ | Medium |
| Distributed Tracing | Jaeger/Tempo | Free | Medium |

Minimum viable monitoring stack:
1. The Graph subgraph for event indexing
2. Grafana panel displaying basic KPIs
3. Email alerts configured for P1/P2 conditions

Expand gradually, adding sophistication as resources and budgets allow.

---

**Document Status:** Complete (Phase 7 Monitoring Component)  
**Next Action:** Configure monitoring dashboards before testnet deployment  
**Classification:** INTERNAL USE ONLY — OPERATIONAL EXPOSURE LIMITED TO AUTHORIZED PERSONNEL
