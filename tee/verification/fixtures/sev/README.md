# SEV-SNP Research Fixtures

**RESEARCH_FIXTURE_ONLY: true**

Synthetic SEV-SNP Report v2 layout for offline VCEK PoC:

- 672-byte signed payload (version 2 header region)
- 96-byte ECDSA P-384 signature at offset 672 (0x2A0)
- Collateral: research SPKI public key (not AMD KDS VCEK)

Not production attestation evidence.
