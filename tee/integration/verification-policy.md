# Verification Policy Design

**Phase**: 8.1  
**Status**: Design Documentation  
**Last Updated**: 2026-08-05

---

## Overview

The Verification Policy defines the rules and logic for determining whether a proof (with or without TEE attestation) should be accepted. This document outlines the verification modes, trust levels, and policy enforcement mechanisms for the AegisProof TEE integration.

---

## Verification Modes

### Mode 1: ZK Only

**Purpose**: Standard verification without TEE attestation

**Use Cases**:
- General-purpose environments
- Edge devices without TEE support
- Low-cost deployments
- Development and testing
- Fallback when TEE unavailable

**Security Guarantees**:
- ZK proof mathematical correctness
- Public signal validation
- Circuit integrity
- Trusted setup validity

**Verification Flow**:
```
ZK Proof
    ↓
ZK Verification (using vkey)
    ↓
Public Signal Validation
    ↓
Circuit Consistency Check
    ↓
Accept/Reject
```

**Policy Rules**:
```typescript
interface ZKOnlyPolicy {
  // Required verifications
  requireZKProof: true;
  requireTEEAttestation: false;
  
  // ZK verification parameters
  zkVerification: {
    proofValidity: true;
    signalValidation: true;
    circuitConsistency: true;
    trustedSetupCheck: true;
  };
  
  // Fallback behavior
  fallback: {
    enabled: false; // This is the fallback mode
    alternativeModes: [];
  };
}
```

**Trust Level**: `MEDIUM` (mathematical trust only)

**Performance**: Low overhead (standard ZK verification)

---

### Mode 2: ZK + TEE

**Purpose**: Enhanced verification with TEE attestation

**Use Cases**:
- Enterprise deployments
- High-security applications
- Regulated industries
- Financial services
- Healthcare applications

**Security Guarantees**:
- All ZK Only guarantees
- TEE execution environment verification
- Code measurement validation
- Hardware-based trust
- Attestation freshness

**Verification Flow**:
```
ZK Proof + TEE Attestation
    ↓
ZK Verification (using vkey)
    ↓
TEE Attestation Verification
    ↓
Cross-Validation (ZK ↔ TEE)
    ↓
Policy Compliance Check
    ↓
Accept/Reject
```

**Policy Rules**:
```typescript
interface ZKPlusTEEPolicy {
  // Required verifications
  requireZKProof: true;
  requireTEEAttestation: true;
  
  // ZK verification parameters
  zkVerification: {
    proofValidity: true;
    signalValidation: true;
    circuitConsistency: true;
    trustedSetupCheck: true;
  };
  
  // TEE verification parameters
  teeVerification: {
    attestationValidity: true;
    measurementValidation: true;
    certificateValidation: true;
    revocationCheck: true;
    freshnessCheck: true;
  };
  
  // Cross-validation parameters
  crossValidation: {
    consistencyCheck: true;
    bindingVerification: true;
    timestampAlignment: true;
  };
  
  // Fallback behavior
  fallback: {
    enabled: true;
    alternativeModes: ["ZK_ONLY"];
    fallbackCondition: "TEE_FAILURE";
  };
}
```

**Trust Level**: `HIGH` (mathematical + hardware trust)

**Performance**: Moderate overhead (ZK + TEE verification)

---

### Mode 3: Dual Provider

**Purpose**: Maximum security using multiple TEE providers

**Use Cases**:
- Critical infrastructure
- High-value transactions
- Government applications
- Defense applications
- Research and validation

**Security Guarantees**:
- All ZK + TEE guarantees
- Redundant TEE verification
- Multi-vendor trust distribution
- Consensus-based acceptance
- Enhanced fault tolerance

**Verification Flow**:
```
ZK Proof + TEE Attestation 1 + TEE Attestation 2
    ↓
ZK Verification (using vkey)
    ↓
TEE Provider 1 Verification
    ↓
TEE Provider 2 Verification
    ↓
Cross-Provider Validation
    ↓
Consensus Check
    ↓
Policy Compliance Check
    ↓
Accept/Reject
```

**Policy Rules**:
```typescript
interface DualProviderPolicy {
  // Required verifications
  requireZKProof: true;
  requireTEEAttestation: true;
  requireMultipleProviders: true;
  
  // Provider configuration
  providers: {
    primary: TEEProviderType;
    secondary: TEEProviderType;
    minRequired: number; // Minimum providers that must succeed
  };
  
  // ZK verification parameters
  zkVerification: {
    proofValidity: true;
    signalValidation: true;
    circuitConsistency: true;
    trustedSetupCheck: true;
  };
  
  // TEE verification parameters (per provider)
  teeVerification: {
    attestationValidity: true;
    measurementValidation: true;
    certificateValidation: true;
    revocationCheck: true;
    freshnessCheck: true;
  };
  
  // Cross-validation parameters
  crossValidation: {
    providerConsistency: true;
    measurementAlignment: true;
    consensusCheck: true;
  };
  
  // Fallback behavior
  fallback: {
    enabled: true;
    alternativeModes: ["ZK_PLUS_TEE", "ZK_ONLY"];
    fallbackCondition: "INSUFFICIENT_PROVIDERS";
  };
}
```

**Trust Level**: `CRITICAL` (mathematical + multi-vendor hardware trust)

**Performance**: High overhead (ZK + multiple TEE verifications)

---

## Policy Engine

### Policy Engine Architecture

```typescript
class VerificationPolicyEngine {
  private policy: VerificationPolicy;
  private adapterLayer: AdapterLayer;
  
  constructor(
    policy: VerificationPolicy,
    adapterLayer: AdapterLayer
  ) {
    this.policy = policy;
    this.adapterLayer = adapterLayer;
  }
  
  async verify(proofBundle: ProofBundle): Promise<PolicyDecision> {
    try {
      // 1. Verify ZK proof
      const zkResult = await this.verifyZKProof(proofBundle.zkProof);
      if (!zkResult.valid) {
        return PolicyDecision.rejected("ZK verification failed");
      }
      
      // 2. Verify TEE attestation (if required)
      if (this.policy.requireTEEAttestation) {
        const teeResult = await this.verifyTEEAttestation(
          proofBundle.teeAttestation
        );
        if (!teeResult.valid) {
          // Check if fallback is enabled
          if (this.policy.fallback.enabled) {
            return this.handleFallback(teeResult.error);
          }
          return PolicyDecision.rejected("TEE verification failed");
        }
        
        // 3. Cross-validation
        if (this.policy.mode !== VerificationMode.ZK_ONLY) {
          const crossResult = await this.crossValidate(
            zkResult,
            teeResult
          );
          if (!crossResult.valid) {
            return PolicyDecision.rejected("Cross-validation failed");
          }
        }
      }
      
      // 4. Policy compliance check
      const complianceResult = this.checkCompliance(proofBundle);
      if (!complianceResult.valid) {
        return PolicyDecision.rejected("Policy compliance failed");
      }
      
      return PolicyDecision.accepted();
      
    } catch (error) {
      return PolicyDecision.error(error);
    }
  }
  
  private async verifyZKProof(
    zkProof: ZKProof
  ): Promise<VerificationResult> {
    // Implement ZK verification logic
    const proofValid = await this.adapterLayer.verifyZKProof(zkProof);
    const signalsValid = await this.adapterLayer.validateSignals(
      zkProof.publicSignals
    );
    
    return {
      valid: proofValid && signalsValid,
      details: {
        proofValidity: proofValid,
        signalValidation: signalsValid
      }
    };
  }
  
  private async verifyTEEAttestation(
    attestation: AttestationEvidence
  ): Promise<VerificationResult> {
    // Implement TEE attestation verification logic
    const provider = this.adapterLayer.getProvider(attestation.providerType);
    const result = await provider.verifyAttestation(attestation);
    
    return {
      valid: result.valid,
      details: {
        attestationValidity: result.valid,
        measurementValidation: result.measurementsValid,
        certificateValidation: result.certificateValid,
        revocationCheck: result.notRevoked,
        freshnessCheck: result.fresh
      }
    };
  }
  
  private async crossValidate(
    zkResult: VerificationResult,
    teeResult: VerificationResult
  ): Promise<VerificationResult> {
    // Implement cross-validation logic
    const consistency = this.checkConsistency(zkResult, teeResult);
    const binding = this.checkBinding(zkResult, teeResult);
    const timestamp = this.checkTimestampAlignment(zkResult, teeResult);
    
    return {
      valid: consistency && binding && timestamp,
      details: {
        consistencyCheck: consistency,
        bindingVerification: binding,
        timestampAlignment: timestamp
      }
    };
  }
  
  private checkCompliance(proofBundle: ProofBundle): VerificationResult {
    // Implement policy compliance checks
    const versionValid = this.checkVersion(proofBundle);
    const timestampValid = this.checkTimestamp(proofBundle);
    const policyValid = this.checkPolicyRules(proofBundle);
    
    return {
      valid: versionValid && timestampValid && policyValid,
      details: {
        versionCheck: versionValid,
        timestampCheck: timestampValid,
        policyCheck: policyValid
      }
    };
  }
  
  private handleFallback(error: string): PolicyDecision {
    // Implement fallback logic
    logger.warn(`TEE verification failed, attempting fallback: ${error}`);
    
    // Try fallback mode
    const fallbackMode = this.policy.fallback.alternativeModes[0];
    const fallbackPolicy = this.createFallbackPolicy(fallbackMode);
    
    // Re-verify with fallback policy
    return this.verifyWithFallback(fallbackPolicy);
  }
}
```

---

## Trust Level Evaluation

### Trust Level Matrix

| Verification Mode | Trust Level | Description |
|-------------------|-------------|-------------|
| ZK Only | MEDIUM | Mathematical trust only |
| ZK + TEE | HIGH | Mathematical + hardware trust |
| Dual Provider | CRITICAL | Mathematical + multi-vendor hardware trust |

### Trust Level Calculation

```typescript
class TrustLevelEvaluator {
  static evaluate(
    verificationResult: VerificationResult,
    mode: VerificationMode
  ): TrustLevel {
    const baseScore = this.getBaseScore(mode);
    const adjustment = this.calculateAdjustment(verificationResult);
    const finalScore = baseScore + adjustment;
    
    return this.scoreToLevel(finalScore);
  }
  
  private static getBaseScore(mode: VerificationMode): number {
    switch (mode) {
      case VerificationMode.ZK_ONLY:
        return 50; // Base score for mathematical trust
      case VerificationMode.ZK_PLUS_TEE:
        return 75; // Base score for mathematical + hardware trust
      case VerificationMode.DUAL_PROVIDER:
        return 90; // Base score for multi-vendor trust
      default:
        return 0;
    }
  }
  
  private static calculateAdjustment(
    result: VerificationResult
  ): number {
    let adjustment = 0;
    
    // Adjust based on verification details
    if (result.details?.attestationValidity) {
      adjustment += 10;
    }
    if (result.details?.measurementValidation) {
      adjustment += 5;
    }
    if (result.details?.certificateValidation) {
      adjustment += 5;
    }
    if (result.details?.revocationCheck) {
      adjustment += 5;
    }
    if (result.details?.freshnessCheck) {
      adjustment += 5;
    }
    
    return adjustment;
  }
  
  private static scoreToLevel(score: number): TrustLevel {
    if (score >= 90) return TrustLevel.CRITICAL;
    if (score >= 70) return TrustLevel.HIGH;
    if (score >= 50) return TrustLevel.MEDIUM;
    return TrustLevel.LOW;
  }
}
```

---

## Policy Configuration

### Policy Configuration Structure

```typescript
interface VerificationPolicy {
  // Policy metadata
  metadata: {
    version: string;
    createdAt: number;
    updatedAt: number;
    author: string;
  };
  
  // Verification mode
  mode: VerificationMode;
  
  // Mode-specific configuration
  configuration: ZKOnlyPolicy | ZKPlusTEEPolicy | DualProviderPolicy;
  
  // Global policy rules
  globalRules: {
    maxProofAge: number; // Maximum age of proof in seconds
    requireFreshness: boolean;
    allowRevokedCertificates: boolean;
    minimumSecurityVersion: number;
  };
  
  // Fallback configuration
  fallback: {
    enabled: boolean;
    alternativeModes: VerificationMode[];
    fallbackConditions: string[];
  };
  
  // Monitoring configuration
  monitoring: {
    logVerificationResults: boolean;
    trackMetrics: boolean;
    alertOnFailure: boolean;
  };
}
```

### Example Configurations

#### ZK Only Configuration

```json
{
  "metadata": {
    "version": "1.0.0",
    "createdAt": 1691234567890,
    "updatedAt": 1691234567890,
    "author": "aegisproof"
  },
  "mode": "ZK_ONLY",
  "configuration": {
    "requireZKProof": true,
    "requireTEEAttestation: false,
    "zkVerification": {
      "proofValidity": true,
      "signalValidation": true,
      "circuitConsistency": true,
      "trustedSetupCheck": true
    },
    "fallback": {
      "enabled": false,
      "alternativeModes": []
    }
  },
  "globalRules": {
    "maxProofAge": 3600,
    "requireFreshness": true,
    "allowRevokedCertificates": false,
    "minimumSecurityVersion": 1
  },
  "fallback": {
    "enabled": false,
    "alternativeModes": [],
    "fallbackConditions": []
  },
  "monitoring": {
    "logVerificationResults": true,
    "trackMetrics": true,
    "alertOnFailure": true
  }
}
```

#### ZK + TEE Configuration

```json
{
  "metadata": {
    "version": "1.0.0",
    "createdAt": 1691234567890,
    "updatedAt": 1691234567890,
    "author": "aegisproof"
  },
  "mode": "ZK_PLUS_TEE",
  "configuration": {
    "requireZKProof": true,
    "requireTEEAttestation": true,
    "zkVerification": {
      "proofValidity": true,
      "signalValidation": true,
      "circuitConsistency": true,
      "trustedSetupCheck": true
    },
    "teeVerification": {
      "attestationValidity": true,
      "measurementValidation": true,
      "certificateValidation": true,
      "revocationCheck": true,
      "freshnessCheck": true
    },
    "crossValidation": {
      "consistencyCheck": true,
      "bindingVerification": true,
      "timestampAlignment": true
    },
    "fallback": {
      "enabled": true,
      "alternativeModes": ["ZK_ONLY"],
      "fallbackCondition": "TEE_FAILURE"
    }
  },
  "globalRules": {
    "maxProofAge": 3600,
    "requireFreshness": true,
    "allowRevokedCertificates": false,
    "minimumSecurityVersion": 2
  },
  "fallback": {
    "enabled": true,
    "alternativeModes": ["ZK_ONLY"],
    "fallbackConditions": ["TEE_FAILURE", "PROVIDER_UNAVAILABLE"]
  },
  "monitoring": {
    "logVerificationResults": true,
    "trackMetrics": true,
    "alertOnFailure": true
  }
}
```

#### Dual Provider Configuration

```json
{
  "metadata": {
    "version": "1.0.0",
    "createdAt": 1691234567890,
    "updatedAt": 1691234567890,
    "author": "aegisproof"
  },
  "mode": "DUAL_PROVIDER",
  "configuration": {
    "requireZKProof": true,
    "requireTEEAttestation": true,
    "requireMultipleProviders": true,
    "providers": {
      "primary": "INTEL_TDX",
      "secondary": "AMD_SEV_SNP",
      "minRequired": 1
    },
    "zkVerification": {
      "proofValidity": true,
      "signalValidation": true,
      "circuitConsistency": true,
      "trustedSetupCheck": true
    },
    "teeVerification": {
      "attestationValidity": true,
      "measurementValidation": true,
      "certificateValidation": true,
      "revocationCheck": true,
      "freshnessCheck": true
    },
    "crossValidation": {
      "providerConsistency": true,
      "measurementAlignment": true,
      "consensusCheck": true
    },
    "fallback": {
      "enabled": true,
      "alternativeModes": ["ZK_PLUS_TEE", "ZK_ONLY"],
      "fallbackCondition": "INSUFFICIENT_PROVIDERS"
    }
  },
  "globalRules": {
    "maxProofAge": 1800,
    "requireFreshness": true,
    "allowRevokedCertificates": false,
    "minimumSecurityVersion": 2
  },
  "fallback": {
    "enabled": true,
    "alternativeModes": ["ZK_PLUS_TEE", "ZK_ONLY"],
    "fallbackConditions": [
      "INSUFFICIENT_PROVIDERS",
      "PROVIDER_UNAVAILABLE",
      "TEE_FAILURE"
    ]
  },
  "monitoring": {
    "logVerificationResults": true,
    "trackMetrics": true,
    "alertOnFailure": true
  }
}
```

---

## Policy Enforcement

### Enforcement Points

1. **Proof Submission**: Validate proof format and required fields
2. **ZK Verification**: Ensure ZK proof is valid
3. **TEE Verification**: Ensure TEE attestation is valid (if required)
4. **Cross-Validation**: Ensure consistency between ZK and TEE
5. **Policy Compliance**: Ensure all policy rules are satisfied
6. **Acceptance/Rejection**: Final decision based on all checks

### Enforcement Flow

```
Proof Submission
    ↓
Format Validation
    ↓
ZK Verification
    ↓
TEE Verification (if required)
    ↓
Cross-Validation (if TEE required)
    ↓
Policy Compliance Check
    ↓
Trust Level Evaluation
    ↓
Accept/Reject Decision
    ↓
Logging & Monitoring
```

---

## Fallback Mechanism

### Fallback Triggers

1. **TEE Unavailable**: TEE provider not accessible
2. **TEE Failure**: TEE attestation generation/verification fails
3. **Certificate Error**: Certificate validation fails
4. **Network Error**: Network connectivity issues
5. **Configuration Error**: Misconfiguration detected

### Fallback Strategy

```typescript
class FallbackManager {
  private policy: VerificationPolicy;
  private adapterLayer: AdapterLayer;
  
  constructor(
    policy: VerificationPolicy,
    adapterLayer: AdapterLayer
  ) {
    this.policy = policy;
    this.adapterLayer = adapterLayer;
  }
  
  async handleFallback(
    error: AdapterError,
    currentMode: VerificationMode
  ): Promise<PolicyDecision> {
    // Check if fallback is enabled
    if (!this.policy.fallback.enabled) {
      return PolicyDecision.rejected(
        "Fallback not enabled, verification failed"
      );
    }
    
    // Check if error triggers fallback
    if (!this.shouldTriggerFallback(error)) {
      return PolicyDecision.rejected(
        "Error does not trigger fallback"
      );
    }
    
    // Get fallback mode
    const fallbackMode = this.selectFallbackMode(currentMode);
    if (!fallbackMode) {
      return PolicyDecision.rejected(
        "No fallback mode available"
      );
    }
    
    // Create fallback policy
    const fallbackPolicy = this.createFallbackPolicy(fallbackMode);
    
    // Re-verify with fallback policy
    logger.info(`Attempting fallback to ${fallbackMode}`);
    return this.reverifyWithFallback(fallbackPolicy);
  }
  
  private shouldTriggerFallback(error: AdapterError): boolean {
    return this.policy.fallback.fallbackConditions.includes(
      error.code
    );
  }
  
  private selectFallbackMode(
    currentMode: VerificationMode
  ): VerificationMode | null {
    const alternatives = this.policy.fallback.alternativeModes;
    
    // Select the most secure fallback mode
    for (const mode of alternatives) {
      if (this.isModeAvailable(mode)) {
        return mode;
      }
    }
    
    return null;
  }
  
  private isModeAvailable(mode: VerificationMode): boolean {
    switch (mode) {
      case VerificationMode.ZK_ONLY:
        return true; // Always available
      case VerificationMode.ZK_PLUS_TEE:
        return this.adapterLayer.hasTEEProvider();
      case VerificationMode.DUAL_PROVIDER:
        return this.adapterLayer.hasMultipleProviders();
      default:
        return false;
    }
  }
  
  private createFallbackPolicy(
    mode: VerificationMode
  ): VerificationPolicy {
    // Create policy for fallback mode
    return {
      ...this.policy,
      mode: mode,
      configuration: this.getConfigurationForMode(mode)
    };
  }
  
  private async reverifyWithFallback(
    fallbackPolicy: VerificationPolicy
  ): Promise<PolicyDecision> {
    const fallbackEngine = new VerificationPolicyEngine(
      fallbackPolicy,
      this.adapterLayer
    );
    
    return fallbackEngine.verify(this.currentProofBundle);
  }
}
```

---

## Monitoring and Alerting

### Metrics to Track

1. **Verification Results**: Success/failure rates by mode
2. **Fallback Events**: Frequency and reasons for fallbacks
3. **TEE Provider Health**: Availability and performance
4. **Trust Level Distribution**: Distribution of trust levels
5. **Policy Violations**: Types and frequency of violations

### Alerting Rules

1. **High Failure Rate**: Alert if failure rate > 5%
2. **Fallback Frequency**: Alert if fallback rate > 10%
3. **TEE Unavailability**: Alert if TEE unavailable > 1 minute
4. **Certificate Expiry**: Alert 30 days before certificate expiry
5. **Security Version**: Alert if security version below minimum

---

## Conclusion

The Verification Policy design provides a flexible, secure framework for verifying proofs with optional TEE attestation. The three-tier verification mode approach allows deployment flexibility while maintaining strong security guarantees.

**Key Features**:
- Three verification modes (ZK Only, ZK + TEE, Dual Provider)
- Flexible policy configuration
- Automatic fallback mechanism
- Trust level evaluation
- Comprehensive monitoring

**Next Steps**:
- Implement policy engine
- Develop policy management tools
- Create monitoring dashboards
- Conduct policy testing

---

## References

- AegisProof Protocol v2: [Link]
- TEE Adapter Layer: [Link]
- Threat Model: [Link]
