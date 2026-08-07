# TDX Research Fixtures

**RESEARCH_FIXTURE_ONLY: true**

Synthetic TDX Quote v4 layout for the offline DCAP PoC:

- 48-byte signed payload (version 4 header)
- 64-byte ECDSA P-256 signature (IEEE P1363)
- Collateral: research SPKI public key (not Intel PCK chain)

Not production attestation evidence.
