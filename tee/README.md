# AegisProof TEE Research

**Phase**: 8  
**Status**: Research & Design Preparation  
**Scope**: Intel TDX, AMD SEV-SNP, Remote Attestation, ZK Proof Integration

---

## Purpose

This directory contains research and design documentation for potential future TEE (Trusted Execution Environment) integration with AegisProof. 

**Important Constraints**:
- This is research-only phase
- No changes to existing protocol v2
- No changes to Circom circuits
- No changes to signals/zkey/vkey
- No changes to trusted setup artifacts
- No production deployments

All cryptographic artifacts from Phases 0-7 remain unchanged.

---

## Directory Structure

```
tee/
├── README.md                    # This file
├── architecture/
│   └── overview.md              # TEE architecture overview
├── intel-tdx/
│   ├── README.md                # Intel TDX specific research
│   ├── attestation.md           # TDX attestation mechanism
│   └── research-notes.md        # TDX research findings
├── amd-sev-snp/
│   ├── README.md                # AMD SEV-SNP specific research
│   ├── attestation.md           # SEV-SNP attestation mechanism
│   └── research-notes.md        # SEV-SNP research findings
└── integration/
    ├── zk-tee-model.md          # ZK + TEE integration model
    └── threat-model.md          # Combined threat model
```

---

## Research Scope

### Intel TDX (Trust Domain Extensions)
- Confidential computing architecture
- Trust boundary definition
- Measurement and attestation
- Remote attestation protocols

### AMD SEV-SNP (Secure Encrypted Virtualization-Secure Nested Paging)
- VM memory encryption
- Secure nested paging
- Attestation reports
- Trust model analysis

### ZK Proof Integration
- Computation delegation to TEE
- Proof generation within TEE
- Attestation + ZK verification flow
- Trust boundary composition

---

## Integration Model

The research explores a hybrid approach:

```
Private Input
      |
      v
+-------------+
| TEE         |
| computation |
+-------------+
      |
      v
ZK Proof Generation
      |
      v
Public Verification
```

### Key Questions
- What guarantees does TEE provide?
- What guarantees does ZK provide?
- Where are the overlaps?
- What new attack surfaces emerge?

---

## Threat Model

Research will analyze:
- TEE compromise scenarios
- Side-channel attacks
- Rollback attacks
- Attestation spoofing
- Malicious operator
- Proof generation manipulation

---

## Status

- [x] Directory structure created
- [ ] Intel TDX documentation
- [ ] AMD SEV-SNP documentation
- [ ] Integration model design
- [ ] Threat model analysis
- [ ] Implementation planning (deferred)

---

## Next Steps

1. Complete TEE technology research
2. Design ZK + TEE integration model
3. Analyze combined threat model
4. Draft implementation requirements
5. Await stakeholder approval before implementation phase

---

## References

- Intel TDX Documentation: https://www.intel.com/content/www/us/en/developer/articles/technical/intel-trust-domain-extensions.html
- AMD SEV-SNP Documentation: https://www.amd.com/en/developer/sev-snp
- TEE Research Papers: [To be added]
