# AegisProof TEE Research

**Phase**: 8.6  
**Status**: Real TEE Integration PoC (Research/Evaluation)  
**Scope**: Intel TDX, AMD SEV-SNP, Attestation Adapter Layer, ZK Proof Integration Research

---

## Purpose

This directory contains research, design, and PoC implementation for TEE (Trusted Execution Environment) integration with AegisProof.

**Important Constraints**:
- This is research and PoC evaluation only
- No changes to existing protocol v2
- No changes to Circom circuits
- No changes to signals/zkey/vkey
- No changes to trusted setup artifacts
- No production deployments
- No production TEE connection
- No production key usage

All cryptographic artifacts from Phases 0-7 remain unchanged.

See [Phase 8.6 PoC Design Document](../docs/research/phase8.6-real-tee-poc.md) for full scope and limitations.

---

## Directory Structure

```
tee/
├── README.md                    # This file
├── architecture/
│   ├── overview.md              # TEE architecture overview
│   └── adapter-layer.md         # Adapter Layer design
├── amd-sev-snp/
│   ├── attestation.md           # SEV-SNP attestation mechanism
│   ├── real-evaluation-design.md
│   └── research-notes.md
├── intel-tdx/
│   ├── attestation.md           # TDX attestation mechanism
│   ├── real-evaluation-design.md
│   └── research-notes.md
├── integration/
│   ├── attestation-flow-design.md
│   ├── verification-policy.md
│   ├── zk-tee-model.md
│   └── threat-model.md
├── mock/                        # Phase 8.3 Mock Provider (evaluation)
│   ├── provider-interface.ts
│   ├── tdx-provider-mock.ts
│   ├── sev-provider-mock.ts
│   ├── evidence-normalizer.ts   # Mock-only normalizer (do not extend for Real)
│   └── evidence-generator.ts    # Mock-only wrapper → ProviderFactory
├── normalizers/                 # Phase 8.6 Real Evidence normalizer
│   └── real-evidence-normalizer.ts
├── parsers/                     # Phase 8.6 structure validation
│   ├── tdx-quote-parser.ts
│   └── sev-report-parser.ts
├── providers/                   # Phase 8.6 Real Provider + Factory
│   ├── tdx-provider.ts
│   ├── sev-snp-provider.ts
│   └── provider-factory.ts
├── poc/
│   └── roadmap.md
├── scripts/
│   └── evaluate.ts              # Evaluation pipeline (Mock + Real PoC)
├── tests/                       # Evaluation and PoC tests
└── threat-model/
    └── adapter-threats.md
```

---

## Phase 8.6 PoC Components

| Component | Location | Role |
|-----------|----------|------|
| TDX Quote Parser | `parsers/tdx-quote-parser.ts` | Quote v4 structure validation |
| SEV Report Parser | `parsers/sev-report-parser.ts` | Report v2 structure validation |
| TDX Provider | `providers/tdx-provider.ts` | Device check + controlled failure |
| SEV-SNP Provider | `providers/sev-snp-provider.ts` | Device check + controlled failure |
| ProviderFactory | `providers/provider-factory.ts` | TEE_ENV-based Mock/Real selection |
| RealEvidenceNormalizer | `normalizers/real-evidence-normalizer.ts` | Real Evidence structure-only normalization |
| Mock Providers | `mock/*` | Phase 8.3/8.4 evaluation (unchanged) |

**PoC Limitations** (production use prohibited):
- No cryptographic signature verification
- No DCAP / VCEK integration
- No remote attestation
- `verifyEvidence()` is a PoC stub (structure validation only)

---

## Evaluation

Run the full evaluation pipeline (Research/PoC only):

```bash
npx tsx tee/scripts/evaluate.ts
```

- **Stage A**: Phase 8.4 Mock Evaluation (Functional, Security, Performance)
- **Stage B**: Phase 8.6 Real TEE PoC Evaluation (Parser, Provider, Factory, Normalizer)

---

## Status

- [x] TEE technology research (Phase 8.1–8.5)
- [x] Mock Provider implementation (Phase 8.3)
- [x] Mock evaluation framework (Phase 8.4)
- [x] Real TEE design (Phase 8.5)
- [x] Real TEE Integration PoC (Phase 8.6)
- [ ] Production TEE integration (deferred — requires Phase 8.7+ approval)

---

## References

- [Phase 8.6 PoC Design](../docs/research/phase8.6-real-tee-poc.md)
- [Phase 8.5 Real TEE Evaluation Plan](../docs/research/phase8.5-real-tee-evaluation-plan.md)
- [Phase 8.4 Evaluation Report](../docs/research/phase8.4-evaluation-report.md)
- Intel TDX Documentation: https://www.intel.com/content/www/us/en/developer/articles/technical/intel-trust-domain-extensions.html
- AMD SEV-SNP Documentation: https://www.amd.com/en/developer/sev-snp
