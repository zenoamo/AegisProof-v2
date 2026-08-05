# Evidence Test Data

**Phase**: 8.2  
**Status**: Test Data  
**Last Updated**: 2026-08-05

---

## Overview

This directory contains test evidence data for validating the Evidence Normalizer and unified AttestationEvidence model.

---

## Test Data Files

### TDX Evidence

#### Valid TDX Quote
**File**: `valid-tdx-quote.json`

A valid Intel TDX quote that should pass all validations:
- Correct structure
- Valid measurements
- Valid signature format
- Fresh timestamp

#### Invalid TDX Quote
**File**: `invalid-tdx-quote.json`

An invalid Intel TDX quote with intentional errors:
- Invalid signature
- Corrupted measurements
- Malformed structure

### SEV-SNP Evidence

#### Valid SEV-SNP Report
**File**: `valid-snp-report.json`

A valid AMD SEV-SNP report that should pass all validations:
- Correct structure
- Valid policy
- Valid measurements
- Valid signature format

#### Invalid SEV-SNP Report
**File**: `invalid-snp-report.json`

An invalid AMD SEV-SNP report with intentional errors:
- Invalid signature
- Invalid policy
- Corrupted measurements

---

## Unified Evidence Format

### Normalized Evidence Structure

```json
{
  "providerType": "INTEL_TDX" | "AMD_SEV_SNP",
  "platformId": "platform_identifier",
  "measurements": {
    "boot": {
      "firmware": "sha256_hash",
      "bootloader": "sha256_hash",
      "kernel": "sha256_hash"
    },
    "config": {
      "system": "sha256_hash",
      "application": "sha256_hash"
    },
    "runtime": {
      "code": "sha256_hash",
      "state": "sha256_hash"
    }
  },
  "attestationData": "base64_encoded_raw_data",
  "timestamp": 1691234567890,
  "signature": {
    "algorithm": "ECDSA_P256" | "ECDSA_P384",
    "value": "base64_encoded_signature",
    "certificateChain": [
      {
        "raw": "base64_encoded_certificate",
        "subject": "certificate_subject",
        "issuer": "certificate_issuer",
        "notBefore": 1691234567890,
        "notAfter": 1722770567890,
        "fingerprint": "sha256_fingerprint"
      }
    ]
  },
  "metadata": {
    "version": "1.0.0",
    "securityLevel": "STANDARD" | "HIGH" | "CRITICAL"
  }
}
```

---

## Validation Test Cases

### Test Case 1: TDX Normalization
**Input**: Valid TDX Quote
**Expected Output**: Unified AttestationEvidence with providerType = "INTEL_TDX"
**Validation**: Measurements correctly mapped, signature preserved

### Test Case 2: SEV-SNP Normalization
**Input**: Valid SEV-SNP Report
**Expected Output**: Unified AttestationEvidence with providerType = "AMD_SEV_SNP"
**Validation**: Measurements correctly mapped, signature preserved

### Test Case 3: Provider Type Preservation
**Input**: Valid TDX Quote and SEV-SNP Report
**Expected Output**: Distinct providerType values preserved
**Validation**: No provider confusion

### Test Case 4: Measurement Consistency
**Input**: Valid evidence from both providers
**Expected Output**: Consistent measurement structure
**Validation**: All providers produce same measurement schema

### Test Case 5: Invalid Data Rejection
**Input**: Malformed evidence
**Expected Output**: Validation error
**Validation**: Invalid data rejected by normalizer

---

## Usage

```typescript
import { EvidenceNormalizer } from '../generators/evidence-generator';
import { readFileSync } from 'fs';

// Load test data
const tdxQuote = JSON.parse(readFileSync('valid-tdx-quote.json', 'utf8'));
const snpReport = JSON.parse(readFileSync('valid-snp-report.json', 'utf8'));

// Normalize evidence
const normalizer = new EvidenceNormalizer();
const tdxEvidence = normalizer.normalize('INTEL_TDX', tdxQuote);
const snpEvidence = normalizer.normalize('AMD_SEV_SNP', snpReport);

// Validate normalization
console.log('TDX Provider Type:', tdxEvidence.providerType);
console.log('SNP Provider Type:', snpEvidence.providerType);
console.log('Measurement schemas match:', 
  JSON.stringify(tdxEvidence.measurements) === JSON.stringify(snpEvidence.measurements)
);
```

---

## Data Generation

Test data is generated using the mock generators:

```bash
# Generate TDX test data
npm run generate:tdx-evidence

# Generate SEV-SNP test data
npm run generate:snp-evidence

# Generate all test data
npm run generate:evidence
```

---

## Safety Notes

- All test data is synthetic
- No real attestation data
- No production certificates
- No real measurement hashes
