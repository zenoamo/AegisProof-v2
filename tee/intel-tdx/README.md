# Intel TDX Research

**Technology**: Intel Trust Domain Extensions  
**Research Phase**: 8  
**Status**: Documentation in Progress

---

## Overview

Intel TDX (Trust Domain Extensions) is a hardware-based confidential computing technology that provides isolation for virtual machines (VMs). It protects guest VMs from the hypervisor and other software on the system.

---

## Key Concepts

### Trust Domain (TD)
- A secure VM that runs in isolated memory
- Protected from hypervisor and other VMs
- Encrypted memory using MKTME
- Attested via remote attestation

### TDX Module
- Firmware component that manages TDX
- Handles key management
- Provides attestation services
- Manages TD lifecycle

### TDG.VP.ENTER/EXIT
- Instructions to enter/exit TDX mode
- Similar to VM enter/exit but with TDX-specific handling
- Provides secure context switching

---

## Security Properties

### Confidentiality
- Guest memory encrypted
- Keys managed by TDX module
- Hypervisor cannot access TD memory
- Multi-Key Total Memory Encryption (MKTME)

### Integrity
- Memory integrity protected
- Hypervisor tampering detected
- Secure boot for TD initialization
- Replay protection

### Attestation
- Remote attestation via TDREPORT
- Quote generation mechanism
- Measurement of TD state
- Cryptographic proof of correct execution

---

## TDX Architecture

```
┌─────────────────────────────────────────┐
│           Physical Hardware              │
├─────────────────────────────────────────┤
│         TDX Module (Firmware)            │
│  - Key Management                        │
│  - Attestation                           │
│  - TD Lifecycle                          │
├─────────────────────────────────────────┤
│         Hypervisor (Untrusted)           │
│  - VM Scheduling                         │
│  - Resource Allocation                   │
│  - Cannot access TD memory               │
├─────────────────────────────────────────┤
│    Trust Domain (TD) - Protected         │
│  ┌───────────────────────────────────┐  │
│  │ Guest OS & Applications           │  │
│  │ Encrypted Memory                 │  │
│  │ Attestation Capable              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Measurement Flow

### TD Initialization
1. **Boot Measurement**: Hash of firmware, bootloader, kernel
2. **Configuration Measurement**: Hash of TD configuration
3. **Runtime Measurement**: Hash of application code
4. **State Measurement**: Hash of runtime state

### Measurement Report Structure
```
TDREPORT {
  - TD measurements (boot, config, runtime)
  - TDX module version
  - Security version
  - CPU security capabilities
  - Signature by TDX attestation key
}
```

---

## Remote Attestation

### Quote Generation
```
TD                          Verifier
 │                              │
 │  1. Generate TDREPORT       │
 │  (local attestation)         │
 │                              │
 │  2. Send to Quote Service    │
 │                              │
 │  3. Get Quote ─────────────>│
 │  (signed by Intel)           │
 │                              │
 │  4. Verify Quote             │
 │  (check Intel signature)     │
 │  (verify measurements)       │
 │                              │
 │  5. Trust Decision           │
 │  <───────────────────────────│
```

### Quote Service
- Intel-provided attestation service
- Signs TDREPORT with Intel key
- Provides revocation information
- Handles quote validation

---

## TDX vs SGX

| Aspect | SGX | TDX |
|--------|-----|-----|
| Isolation Level | Enclave (app-level) | VM (OS-level) |
| Memory Size | Limited (few hundred MB) | Large (GB to TB) |
| OS Support | Requires SGX-aware apps | Any OS in TD |
| Hypervisor Interaction | Direct | Protected |
| Maturity | More mature | Newer technology |
| Future | Being phased out | Primary Intel TEE |

---

## Use Cases for AegisProof

### Potential Applications
- **Secure Proof Generation**: Generate ZK proofs within TDX TD
- **Key Management**: Store private keys in encrypted memory
- **Confidential Computation**: Process sensitive data before proof generation
- **Attestation Integration**: Combine TDX attestation with ZK verification

### Integration Points
```
Private Input → TDX TD → Computation → ZK Proof → Verification
                    ↓
              TDX Attestation
                    ↓
            Combined Verification
```

---

## Security Considerations

### Trusted Components
- Intel CPU hardware
- TDX module firmware
- Intel attestation service
- TD code and configuration

### Attack Vectors
- **Hardware Vulnerabilities**: CPU bugs (e.g., transient execution)
- **Firmware Compromise**: TDX module vulnerabilities
- **Side Channels**: Timing, cache attacks
- **Denial of Service**: Hardware-level disruption

### Mitigations
- Regular security updates
- Defense in depth
- Monitoring and detection
- Redundancy and geographic distribution

---

## Performance Characteristics

### Expected Overhead
- **Memory Access**: ~5-10% overhead due to encryption
- **Context Switch**: Additional TDX-specific overhead
- **Attestation**: Network latency to quote service
- **I/O**: Some operations require special handling

### Optimization Opportunities
- Batch proof generation within TD
- Cached attestation results
- Optimized memory access patterns
- Parallel computation within TD

---

## Research Tasks

### [ ] Documentation Review
- [ ] Intel TDX specification
- [ ] TDX developer guide
- [ ] Attestation protocol details
- [ ] Security analysis papers

### [ ] Proof of Concept Planning
- [ ] TDX environment setup requirements
- [ ] Proof generation in TD design
- [ ] Attestation integration flow
- [ ] Performance benchmarking plan

### [ ] Security Analysis
- [ ] Threat model for TDX + ZK
- [ ] Attack surface analysis
- [ ] Mitigation strategies
- [ ] Incident response planning

---

## References

- Intel TDX Documentation: https://www.intel.com/content/www/us/en/developer/articles/technical/intel-trust-domain-extensions.html
- Intel SGX to TDX Migration: https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sgx-to-tdx-migration.html
- Confidential Computing Consortium: https://confidentialcomputing.io/
