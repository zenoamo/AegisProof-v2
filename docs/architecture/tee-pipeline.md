# TEE Attestation Pipeline Architecture

**Status:** Frozen (ADR-001)  
**HEAD reference:** `9d8b7d0`  
**Last updated:** 2026-08-06

---

## Overview

The TEE Adapter Layer (Layer B) uses a **compose-only pipeline** introduced in Phase 8.9C-pre.4. Business logic lives in individual components; `AttestationPipeline` orchestrates call order and error conversion only.

See [ADR-001: Architecture Hardening Freeze](../adr/001-architecture-hardening-freeze.md) for binding decisions.

---

## Component Flow (Real Path)

```mermaid
flowchart TD
  subgraph input["Pipeline Input"]
    PI[PipelineInput<br/>path=real]
  end

  subgraph orchestrator["AttestationPipeline — COMPOSE ONLY"]
    direction TB
    O1["① delegate"]
    O2["② delegate"]
    O3["③ delegate"]
    O4["④ delegate optional"]
    O5["⑤ delegate optional"]
  end

  Provider["ProviderFactory<br/>→ TeeProvider"]
  Verifier["VerificationFactory<br/>→ TeeVerifier"]
  Normalizer["RealEvidenceNormalizer"]
  ClaimsGate["ClaimsGate<br/>verification prerequisite"]
  Policy["VerificationPolicy<br/>level allow/deny"]
  PipelineResult["Result&lt;PipelineOutput&gt;"]

  PI --> O1
  O1 --> Provider
  Provider --> O2
  O2 --> Verifier
  Verifier --> O3
  O3 --> Normalizer
  Normalizer --> O4
  O4 -->|"enableClaims=true"| ClaimsGate
  ClaimsGate -->|"delegate"| ZkMapper["ZkClaimsMapper"]
  Normalizer --> O5
  Verifier --> O5
  O5 --> Policy
  O4 --> PipelineResult
  O5 --> PipelineResult

  style orchestrator fill:#f9f9f9,stroke:#333,stroke-dasharray: 5 5
  style ClaimsGate fill:#e8f4e8,stroke:#2d6a2d
  style PipelineResult fill:#e8eef8,stroke:#2d4a6a
```

> **AttestationPipeline** (dashed box): orchestrator only — no verification, claims, policy, parser, or normalizer logic inside.

---

## Component Flow (Mock Path)

```mermaid
flowchart TD
  subgraph input["Pipeline Input"]
    PI[PipelineInput<br/>path=mock]
  end

  Provider["ProviderFactory<br/>→ Mock Provider"]
  MockNorm["EvidenceNormalizer<br/>Mock only"]
  MockVer["Synthetic verification<br/>VerificationLevel.NONE"]
  PipelineResult["Result&lt;PipelineOutput&gt;<br/>claims=undefined"]

  PI --> Provider
  Provider --> MockNorm
  MockNorm --> MockVer
  MockVer --> PipelineResult

  style MockNorm fill:#fff3e0,stroke:#e65100
  style MockVer fill:#fff3e0,stroke:#e65100
```

Mock path **never** calls `ClaimsGate`. Claims generation is forbidden regardless of `enableClaims`.

---

## Trust & Configuration Layers

```mermaid
flowchart LR
  subgraph config["Configuration (pre.2)"]
    RTC["TeeRuntimeConfig<br/>TEE_ENV / TEE_ACQUISITION / TEE_VERIFICATION"]
  end

  subgraph domain["Domain Types (pre.1)"]
    VL["VerificationLevel<br/>Trust Level"]
    TVR["TeeVerificationResult"]
    RES["Result&lt;T&gt; + AttestationError"]
  end

  subgraph policy["Policy (pre.2)"]
    VP["VerificationPolicy<br/>level allow/deny"]
  end

  subgraph gate["Gate (pre.3)"]
    CG["ClaimsGate<br/>sole claims entry"]
  end

  RTC --> ProviderFactory
  RTC --> VerificationFactory
  VL --> TVR
  TVR --> CG
  VP --> Pipeline
  CG --> ZkClaimsMapper

  Pipeline["AttestationPipeline"]
```

### Semantic separation (frozen)

| Field / Type | Represents | MUST NOT represent |
|--------------|------------|-------------------|
| `VerificationLevel` | Trust level | Research scope |
| `pocScope` | Research scope label | Trust level |
| `isValid` | Verifier outcome flag | Sufficient alone for claims |

---

## Directory Map (Hardening additions)

```
tee/
├── config/
│   └── tee-runtime-config.ts      # Centralized env parsing
├── domain/
│   ├── verification-level.ts
│   ├── tee-verification-result.ts
│   ├── attestation-error.ts
│   └── attestation-result.ts
├── policy/
│   └── verification-policy.ts
├── integration/
│   ├── claims-gate.ts             # Claims entry (pre.3)
│   └── zk-claims-mapper.ts        # Unchanged; delegated to
├── pipeline/
│   └── attestation-pipeline.ts    # Orchestrator (pre.4)
└── scripts/
    └── evaluate.ts                # Stages A–G
```

---

## Regression Anchors

| Stage | Scope |
|-------|-------|
| A–F | Pre-hardening baselines (unchanged) |
| **G** | Pipeline E2E — mock/real path, claims gate, policy, `Result` propagation |

Run all stages:

```bash
npx tsx tee/scripts/evaluate.ts
```

---

## Extension Guidelines (Phase 8.9C+)

When adding Remote Verifier or online verification:

1. Add new `TeeVerifier` implementation — do **not** modify pipeline orchestration logic
2. Register via `VerificationFactory` — preserve public API
3. Assign appropriate `VerificationLevel` (e.g., `OFFLINE_VERIFIED`, `HARDWARE_ROOTED`)
4. Update `VerificationPolicy` if new levels need claims eligibility
5. Pass Stage A–G before merge
6. If pipeline flow changes, publish a new ADR — do not silently drift

---

## Related Documents

- [ADR-001: Architecture Hardening Freeze](../adr/001-architecture-hardening-freeze.md)
- [Phase 8.9 Remote Attestation Design](../research/phase8.9-remote-attestation-design.md)
- [TEE README](../../tee/README.md)
