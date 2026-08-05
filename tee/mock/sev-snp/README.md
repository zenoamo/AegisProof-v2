# AMD SEV-SNP Mock Implementation

**Phase**: 8.2  
**Status**: Mock Implementation  
**Last Updated**: 2026-08-05

---

## Overview

This directory contains the mock implementation of AMD SEV-SNP attestation for testing purposes. The mock simulates SEV-SNP behavior without requiring actual SEV-SNP hardware.

---

## Components

### 1. Mock Report Generator
**File**: `mock-report-generator.ts`

Generates realistic SEV-SNP reports for testing:
- Valid reports
- Invalid signature reports
- Invalid policy reports
- Invalid measurement reports

### 2. Mock Report Parser
**File**: `mock-report-parser.ts`

Parses and validates SEV-SNP reports:
- Required field validation
- Policy format validation
- Measurement structure validation
- Signature format validation

### 3. Mock Verifier
**File**: `mock-verifier.ts`

Simulates SEV-SNP report verification:
- Signature verification simulation
- Policy validation
- Measurement validation
- Certificate chain validation

### 4. Test Cases
**File**: `test-cases.ts`

Comprehensive test cases for SEV-SNP mock:
- VALID_SNP_REPORT
- INVALID_SIGNATURE
- INVALID_POLICY
- INVALID_MEASUREMENT

---

## Test Data Structure

### Valid SEV-SNP Report
```json
{
  "version": "1.0",
  "guest_svn": 1,
  "policy": 1,
  "family_id": "16_byte_family_id",
  "image_id": "16_byte_image_id",
  "measurement": "sha256_hash_measurement",
  "launch_measurement": "sha256_hash_launch",
  "host_data": "32_byte_host_data",
  "id_key_digest": "sha256_hash_idkey",
  "author_key_digest": "sha256_hash_authorkey",
  "report_id": "96_byte_report_id",
  "signature": {
    "algorithm": "ECDSA_P384",
    "value": "96_byte_signature",
    "certificateId": "amd-snp-cert-001"
  },
  "certificates": [
    {
      "raw": "256_byte_certificate",
      "subject": "CN=AMD SEV-SNP Attestation",
      "issuer": "CN=AMD Root CA",
      "notBefore": 1691234567890,
      "notAfter": 1722770567890,
      "fingerprint": "32_byte_fingerprint"
    }
  ]
}
```

---

## Implementation Status

- [x] Mock Report Generator design
- [x] Mock Report Parser design
- [x] Mock Verifier design
- [x] Test Cases design
- [ ] TypeScript implementation
- [ ] Go implementation
- [ ] Integration with Adapter Layer
- [ ] Comprehensive testing

---

## Usage

```typescript
import { MockSNPReportGenerator, MockSNPVerifier } from './mock-report-generator';
import { SNPTestCases } from './test-cases';

// Create generator and verifier
const generator = new MockSNPReportGenerator();
const verifier = new MockSNPVerifier();

// Generate valid report
const validReport = generator.generateValidReport();
const result = await verifier.verifyReport(validReport);

// Run test cases
const testCases = new SNPTestCases();
const results = await testCases.runAllTests();
```

---

## Safety Notes

- No actual SEV-SNP hardware access
- No AMD PSP device access
- No real cryptographic operations
- Completely isolated from production
