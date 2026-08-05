# Adapter Layer Threat Model

**Phase**: 8.1  
**Status**: Security Analysis  
**Last Updated**: 2026-08-05

---

## Overview

This document analyzes the threat model specific to the TEE Adapter Layer introduced in Phase 8.1. It identifies potential attack vectors against the abstraction layer, attestation providers, and policy enforcement mechanisms.

---

## Threat Model Scope

### System Boundaries

```
┌─────────────────────────────────────────┐
│         External Adversary               │
│  - Network attackers                    │
│  - Malicious clients                    │
│  - Compromised verifiers               │
└─────────────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────┐
│         Adapter Layer                   │
│  - AttestationProvider Interface       │
│  - Evidence Normalizer                 │
│  - Policy Engine                       │
│  - Provider Factory                    │
└─────────────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────┐
│         Provider Adapters                │
│  - TDX Adapter                         │
│  - SEV-SNP Adapter                     │
│  - Mock Adapter                        │
└─────────────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────┐
│         TEE Platforms                    │
│  - Intel TDX Hardware                   │
│  - AMD SEV-SNP Hardware                 │
└─────────────────────────────────────────┘
```

### Trust Assumptions
- **TEE Hardware**: Underlying TEE hardware is secure (within hardware constraints)
- **TEE Firmware**: TEE firmware is authentic (until proven otherwise)
- **ZK Verification**: Existing ZK verification logic is correct
- **Cryptography**: Underlying cryptographic primitives are secure
- **Adapter Code**: Adapter layer code is audited and secure

---

## Threat Categories

### 1. Adapter Layer Attacks

#### 1.1 Interface Abuse
**Description**: Attacker abuses the AttestationProvider interface to bypass security checks

**Impact**: Medium
- Unauthorized attestation generation
- Bypass of policy enforcement
- Invalid evidence acceptance

**Likelihood**: Medium
- Public interface
- Complex input validation
- Potential for logical errors

**Attack Vector**:
```typescript
// Attacker attempts to bypass interface validation
const maliciousEvidence = {
  providerType: TEEProviderType.INTEL_TDX,
  measurements: {
    boot: { firmware: "malicious_hash" },
    config: { system: "malicious_hash" },
    runtime: { code: "malicious_hash" }
  },
  signature: {
    algorithm: "ECDSA_P256",
    value: forgedSignature,
    certificateChain: forgedCertificates
  }
};

// Bypass validation if interface checks are insufficient
const result = await provider.verifyAttestation(maliciousEvidence);
```

**Mitigation**:
- Strict input validation
- Type safety enforcement
- Comprehensive interface testing
- Runtime validation checks

---

#### 1.2 Evidence Spoofing
**Description**: Attacker creates fake attestation evidence that passes validation

**Impact**: High
- False trust in non-TEE environment
- Bypass of TEE security guarantees
- Invalid proof acceptance

**Likelihood**: Low-Medium
- Requires cryptographic key compromise
- Complex to implement
- Possible through interface bugs

**Attack Vector**:
```typescript
// Attacker creates spoofed evidence
const spoofedEvidence: AttestationEvidence = {
  providerType: TEEProviderType.INTEL_TDX,
  platformId: "fake-platform-id",
  measurements: {
    boot: { firmware: "legitimate_hash" },
    config: { system: "legitimate_hash" },
    runtime: { code: "legitimate_hash" }
  },
  attestationData: fakeAttestationData,
  timestamp: Date.now(),
  signature: {
    algorithm: "ECDSA_P256",
    value: compromisedKeySignature,
    certificateChain: compromisedCertificates
  },
  metadata: {
    version: "1.0.0",
    securityLevel: SecurityLevel.HIGH
  }
};
```

**Mitigation**:
- Strong certificate validation
- Measurement verification
- Hardware binding checks
- Anti-spoofing mechanisms

---

#### 1.3 Normalization Bypass
**Description**: Attacker exploits bugs in evidence normalization to bypass validation

**Impact**: Medium
- Invalid evidence accepted
- Validation logic bypassed
- Inconsistent state

**Likelihood**: Low
- Normalization logic is simple
- Well-tested code paths
- Limited attack surface

**Attack Vector**:
```typescript
// Attacker provides malformed evidence that bypasses normalization
const malformedEvidence = {
  providerType: "INVALID_TYPE" as TEEProviderType,
  measurements: null, // Bypass measurement validation
  attestationData: new Uint8Array(0),
  timestamp: -1, // Invalid timestamp
  signature: null
};

// Normalization fails to handle edge cases
const normalized = normalizer.normalize(
  malformedEvidence.providerType,
  malformedEvidence
);
```

**Mitigation**:
- Comprehensive edge case handling
- Strict type checking
- Null/undefined validation
- Fuzz testing

---

### 2. Provider-Specific Attacks

#### 2.1 TDX Adapter Compromise
**Description**: Attacker compromises TDX adapter to generate fake attestations

**Impact**: High
- Fake TDX attestations
- Intel quote service bypass
- TDX-specific security violations

**Likelihood**: Low
- Requires adapter code compromise
- TDX-specific knowledge needed
- Hardware-specific attack

**Attack Vector**:
```typescript
// Attacker compromises TDX adapter
class CompromisedTDXAdapter extends TDXAdapter {
  async generateAttestation(
    nonce: Uint8Array,
    userData?: Uint8Array
  ): Promise<AttestationEvidence> {
    // Bypass real TDX attestation
    return this.generateFakeAttestation(nonce, userData);
  }
  
  private generateFakeAttestation(
    nonce: Uint8Array,
    userData?: Uint8Array
  ): AttestationEvidence {
    return {
      providerType: TEEProviderType.INTEL_TDX,
      platformId: "compromised-tdx",
      measurements: this.generateFakeMeasurements(),
      attestationData: this.generateFakeQuote(),
      timestamp: Date.now(),
      signature: this.generateFakeSignature(),
      metadata: {
        version: "1.0.0",
        securityLevel: SecurityLevel.HIGH
      }
    };
  }
}
```

**Mitigation**:
- Code signing and verification
- Runtime integrity checks
- Adapter code auditing
- Hardware attestation of adapter

---

#### 2.2 SEV-SNP Adapter Compromise
**Description**: Attacker compromises SEV-SNP adapter to generate fake attestations

**Impact**: High
- Fake SEV-SNP attestations
- AMD certificate chain bypass
- SEV-SNP-specific security violations

**Likelihood**: Low
- Requires adapter code compromise
- SEV-SNP-specific knowledge needed
- Hardware-specific attack

**Attack Vector**:
```typescript
// Attacker compromises SEV-SNP adapter
class CompromisedSEVSNPAdapter extends SEVSNPAdapter {
  async generateAttestation(
    nonce: Uint8Array,
    userData?: Uint8Array
  ): Promise<AttestationEvidence> {
    // Bypass real SEV-SNP attestation
    return this.generateFakeAttestation(nonce, userData);
  }
  
  private generateFakeAttestation(
    nonce: Uint8Array,
    userData?: Uint8Array
  ): AttestationEvidence {
    return {
      providerType: TEEProviderType.AMD_SEV_SNP,
      platformId: "compromised-snp",
      measurements: this.generateFakeMeasurements(),
      attestationData: this.generateFakeReport(),
      timestamp: Date.now(),
      signature: {
        algorithm: "ECDSA_P384",
        value: this.generateFakeSignature(),
        certificateChain: this.generateFakeCertificates()
      },
      metadata: {
        version: "1.0.0",
        securityLevel: SecurityLevel.HIGH
      }
    };
  }
}
```

**Mitigation**:
- Code signing and verification
- Runtime integrity checks
- Adapter code auditing
- Hardware attestation of adapter

---

#### 2.3 Provider Confusion
**Description**: Attacker confuses the system about which provider is being used

**Impact**: Medium
- Wrong verification logic applied
- Cross-provider attacks
- Policy bypass

**Likelihood**: Low-Medium
- Complex provider selection logic
- Potential for configuration errors
- Auto-detection vulnerabilities

**Attack Vector**:
```typescript
// Attacker confuses provider selection
const evidence = {
  providerType: TEEProviderType.INTEL_TDX, // Claims TDX
  platformId: "amd-platform", // But has AMD platform ID
  measurements: {
    // SEV-SNP measurements instead of TDX
    boot: { firmware: "snp-firmware-hash" },
    config: { system: "snp-config-hash" },
    runtime: { code: "snp-code-hash" }
  },
  // ... rest of evidence
};

// System applies TDX verification to SEV-SNP evidence
const result = await tdxAdapter.verifyAttestation(evidence);
```

**Mitigation**:
- Strict provider type validation
- Platform ID verification
- Measurement format validation
- Cross-provider consistency checks

---

### 3. Policy Engine Attacks

#### 3.1 Policy Bypass
**Description**: Attacker bypasses policy enforcement mechanisms

**Impact**: High
- Invalid proofs accepted
- Security policies violated
- Trust model broken

**Likelihood**: Low-Medium
- Complex policy logic
- Potential for logical errors
- Configuration vulnerabilities

**Attack Vector**:
```typescript
// Attacker crafts proof that bypasses policy
const maliciousProof = {
  zkProof: validZKProof, // Valid ZK proof
  teeAttestation: invalidAttestation, // Invalid TEE attestation
  timestamp: oldTimestamp // Old timestamp
};

// Policy engine fails to check timestamp
const decision = await policyEngine.verify(maliciousProof);
// Accepts despite old timestamp
```

**Mitigation**:
- Comprehensive policy validation
- Strict rule enforcement
- Policy testing and auditing
- Configuration validation

---

#### 3.2 Fallback Abuse
**Description**: Attacker forces fallback to less secure mode

**Impact**: Medium
- Downgrade to ZK-only mode
- Bypass of TEE requirements
- Reduced security guarantees

**Likelihood**: Medium
- Fallback mechanism designed for resilience
- Potential for intentional triggering
- Monitoring may detect abuse

**Attack Vector**:
```typescript
// Attacker forces fallback
const attackProof = {
  zkProof: validZKProof,
  teeAttestation: malformedAttestation // Malformed to trigger fallback
};

// System falls back to ZK-only mode
const decision = await policyEngine.verify(attackProof);
// Fallback to less secure mode accepted
```

**Mitigation**:
- Fallback rate limiting
- Fallback event monitoring
- Minimum security level enforcement
- Fallback authentication

---

#### 3.3 Trust Level Manipulation
**Description**: Attacker manipulates trust level evaluation

**Impact**: Medium
- Incorrect trust assessment
- Inappropriate acceptance decisions
- Policy violations

**Likelihood**: Low
- Trust level calculation is deterministic
- Based on verification results
- Limited manipulation surface

**Attack Vector**:
```typescript
// Attacker manipulates trust level inputs
const manipulatedResult = {
  valid: true,
  details: {
    attestationValidity: true, // Force true
    measurementValidation: true, // Force true
    certificateValidation: true, // Force true
    revocationCheck: true, // Force true
    freshnessCheck: true // Force true
  }
};

// Trust level evaluator returns inflated score
const trustLevel = TrustLevelEvaluator.evaluate(
  manipulatedResult,
  VerificationMode.ZK_PLUS_TEE
);
// Returns CRITICAL despite incomplete verification
```

**Mitigation**:
- Deterministic trust calculation
- Input validation
- Result verification
- Trust level caps

---

### 4. Configuration Attacks

#### 4.1 Configuration Drift
**Description**: Configuration changes over time, leading to security vulnerabilities

**Impact**: Medium
- Inconsistent security policies
- Unexpected behavior
- Security degradation

**Likelihood**: Medium
- Configuration management complexity
- Human error in changes
- Lack of configuration validation

**Attack Vector**:
```json
// Initial secure configuration
{
  "mode": "ZK_PLUS_TEE",
  "fallback": {
    "enabled": true,
    "alternativeModes": ["ZK_ONLY"]
  }
}

// Drifted configuration (less secure)
{
  "mode": "ZK_ONLY", // Downgraded without authorization
  "fallback": {
    "enabled": false, // Fallback disabled
    "alternativeModes": []
  }
}
```

**Mitigation**:
- Configuration versioning
- Change approval process
- Configuration validation
- Configuration drift monitoring

---

#### 4.2 Configuration Injection
**Description**: Attacker injects malicious configuration

**Impact**: High
- Complete security bypass
- System compromise
- Data exposure

**Likelihood**: Low
- Requires configuration access
- Configuration validation present
- Attack requires privileges

**Attack Vector**:
```json
// Attacker injects malicious configuration
{
  "mode": "ZK_ONLY", // Force insecure mode
  "configuration": {
    "requireZKProof": false, // Disable ZK verification
    "requireTEEAttestation": false
  },
  "globalRules": {
    "maxProofAge": 999999999, // Accept very old proofs
    "allowRevokedCertificates": true // Accept revoked certificates
  }
}
```

**Mitigation**:
- Configuration validation
- Access controls
- Configuration signing
- Audit logging

---

### 5. Integration Attacks

#### 5.1 ZK-TEE Inconsistency
**Description**: Attacker creates inconsistency between ZK proof and TEE attestation

**Impact**: Medium
- Inconsistent security guarantees
- Trust model violation
- Potential bypass

**Likelihood**: Medium
- Complex integration
- Multiple components
- Potential for synchronization errors

**Attack Vector**:
```typescript
// Attacker creates inconsistent proof
const inconsistentProof = {
  zkProof: {
    publicSignals: {
      deviceId: "device-001",
      timestamp: 1234567890
    }
  },
  teeAttestation: {
    measurements: {
      runtime: {
        deviceId: "device-002", // Different device ID
        timestamp: 1234567891 // Different timestamp
      }
    }
  }
};

// Cross-validation fails to detect inconsistency
const decision = await policyEngine.verify(inconsistentProof);
```

**Mitigation**:
- Strict cross-validation
- Consistency checks
- Binding verification
- Comprehensive testing

---

#### 5.2 Rollback Attacks
**Description**: Attacker forces system to use old, vulnerable versions

**Impact**: Medium
- Vulnerability exploitation
- Security downgrade
- Known attack vectors

**Likelihood**: Low
- Version enforcement mechanisms
- Configuration validation
- Monitoring

**Attack Vector**:
```typescript
// Attacker forces rollback
const rollbackRequest = {
  targetVersion: "1.0.0", // Old vulnerable version
  currentVersion: "2.0.0"
};

// System rolls back without proper validation
await adapterLayer.rollbackToVersion(rollbackRequest.targetVersion);
```

**Mitigation**:
- Version enforcement
- Rollback authorization
- Vulnerability checking
- Minimum version requirements

---

### 6. Operational Attacks

#### 6.1 Denial of Service
**Description**: Attacker disrupts adapter layer operations

**Impact**: Low-Medium
- Service unavailability
- Performance degradation
- User experience impact

**Likelihood**: High
- DoS attacks common
- Multiple attack vectors
- Difficult to prevent completely

**Attack Vector**:
```typescript
// Attacker floods adapter with requests
for (let i = 0; i < 1000000; i++) {
  adapterLayer.generateAttestation(randomNonce);
}

// Adapter becomes unresponsive
```

**Mitigation**:
- Rate limiting
- Request throttling
- Resource monitoring
- Graceful degradation

---

#### 6.2 Resource Exhaustion
**Description**: Attacker exhausts adapter layer resources

**Impact**: Medium
- Memory exhaustion
- CPU exhaustion
- System crash

**Likelihood**: Medium
- Resource management complexity
- Potential for memory leaks
- Complex resource cleanup

**Attack Vector**:
```typescript
// Attacker exhausts memory
const largeEvidence = {
  measurements: {
    boot: { firmware: "a".repeat(10000000) },
    config: { system: "b".repeat(10000000) },
    runtime: { code: "c".repeat(10000000) }
  },
  attestationData: new Uint8Array(100000000),
  // ... large data structures
};

// Memory exhaustion
await adapterLayer.verifyAttestation(largeEvidence);
```

**Mitigation**:
- Resource limits
- Input size validation
- Memory monitoring
- Resource cleanup

---

## Risk Assessment Matrix

| Threat | Impact | Likelihood | Risk Level | Priority |
|--------|--------|------------|------------|----------|
| Interface Abuse | Medium | Medium | Medium | High |
| Evidence Spoofing | High | Low-Medium | Medium | High |
| Normalization Bypass | Medium | Low | Low-Medium | Medium |
| TDX Adapter Compromise | High | Low | Medium | High |
| SEV-SNP Adapter Compromise | High | Low | Medium | High |
| Provider Confusion | Medium | Low-Medium | Medium | Medium |
| Policy Bypass | High | Low-Medium | Medium | High |
| Fallback Abuse | Medium | Medium | Medium | Medium |
| Trust Level Manipulation | Medium | Low | Low-Medium | Medium |
| Configuration Drift | Medium | Medium | Medium | Medium |
| Configuration Injection | High | Low | Medium | High |
| ZK-TEE Inconsistency | Medium | Medium | Medium | Medium |
| Rollback Attacks | Medium | Low | Low-Medium | Medium |
| Denial of Service | Low-Medium | High | Medium | Medium |
| Resource Exhaustion | Medium | Medium | Medium | Medium |

---

## Mitigation Strategy

### Defense in Depth

```
Layer 1: Input Validation
- Type checking
- Format validation
- Size limits
- Range validation

Layer 2: Logic Protection
- Interface contract enforcement
- Policy validation
- Consistency checks
- State validation

Layer 3: Runtime Protection
- Resource monitoring
- Rate limiting
- Error handling
- Logging

Layer 4: Configuration Security
- Configuration validation
- Access controls
- Version management
- Audit logging

Layer 5: Operational Security
- Monitoring
- Alerting
- Incident response
- Regular audits
```

### Specific Mitigations by Priority

#### High Priority
1. **Evidence Spoofing**
   - Strong certificate validation
   - Measurement verification
   - Hardware binding
   - Anti-spoofing mechanisms

2. **TDX/SEV-SNP Adapter Compromise**
   - Code signing
   - Runtime integrity
   - Regular audits
   - Hardware attestation

3. **Policy Bypass**
   - Comprehensive validation
   - Strict enforcement
   - Policy testing
   - Configuration validation

4. **Configuration Injection**
   - Configuration validation
   - Access controls
   - Configuration signing
   - Audit logging

#### Medium Priority
1. **Interface Abuse**
   - Strict validation
   - Type safety
   - Comprehensive testing
   - Runtime checks

2. **Provider Confusion**
   - Type validation
   - Platform verification
   - Measurement validation
   - Cross-provider checks

3. **Fallback Abuse**
   - Rate limiting
   - Event monitoring
   - Minimum security
   - Fallback authentication

4. **Configuration Drift**
   - Versioning
   - Approval process
   - Validation
   - Drift monitoring

---

## Monitoring and Detection

### Key Metrics
1. **Adapter Health**: Provider availability, response times
2. **Verification Results**: Success/failure rates by provider
3. **Fallback Events**: Frequency, reasons, patterns
4. **Configuration Changes**: Change frequency, authorization
5. **Resource Usage**: Memory, CPU, network

### Alerting Rules
1. **High Failure Rate**: Alert if failure rate > 5%
2. **Fallback Frequency**: Alert if fallback rate > 10%
3. **Configuration Changes**: Alert on unauthorized changes
4. **Resource Anomalies**: Alert on unusual resource usage
5. **Provider Unavailability**: Alert if provider unavailable > 1 minute

---

## Incident Response

### Detection
- Anomaly detection in adapter behavior
- Verification failure patterns
- Configuration change alerts
- Resource usage anomalies

### Response
1. **Immediate**: Isolate affected components, preserve evidence
2. **Investigation**: Determine root cause, assess impact
3. **Remediation**: Apply patches, update configurations
4. **Post-Incident**: Post-mortem, update procedures

---

## Conclusion

The Adapter Layer introduces new attack surfaces but also provides opportunities for enhanced security through proper design and implementation. The key risks are around evidence spoofing, provider compromise, and policy bypass.

**Key Recommendations**:
1. Implement comprehensive input validation
2. Strong certificate and measurement validation
3. Strict policy enforcement and fallback monitoring
4. Configuration security and validation
5. Comprehensive monitoring and alerting

The adapter layer can be secure if proper mitigations are implemented and maintained. The design prioritizes defense in depth and fallback safety to ensure resilience even if individual components are compromised.

---

## References

- AegisProof Threat Model: [Link]
- TEE Adapter Layer: [Link]
- Verification Policy: [Link]
- Security Best Practices: [Link]
