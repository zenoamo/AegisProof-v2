# TEE Mock Framework

**Phase**: 8.2  
**Status**: Evaluation Framework  
**Last Updated**: 2026-08-05

---

## Overview

Simulates TEE attestation for testing the Adapter Layer without TEE hardware. Used for local development and testing of attestation providers, evidence normalization, and policy enforcement.

---

## Design Principles

### 1. Hardware Independence
- No TEE hardware required
- Works on standard development machines
- Cross-platform compatibility

### 2. Realistic behavior
- Simulates TEE behavior patterns
- Generates attestation data in expected formats
- Covers common failure scenarios

### 3. Testability
- Deterministic behavior for testing
- Configurable success/failure scenarios
- Test coverage for adapter integration

### 4. Safety
- No connection to production TEE services
- No real cryptographic operations
- Isolated from production systems

---

## Framework Structure

```
tee/mock/
├── README.md                    # This file
├── tdx/                         # Intel TDX mock implementation
│   ├── README.md
│   ├── mock-quote-generator.ts
│   ├── mock-quote-parser.ts
│   ├── mock-verifier.ts
│   └── test-cases.ts
├── sev-snp/                     # AMD SEV-SNP mock implementation
│   ├── README.md
│   ├── mock-report-generator.ts
│   ├── mock-report-parser.ts
│   ├── mock-verifier.ts
│   └── test-cases.ts
├── evidence/                    # Evidence test data
│   ├── valid-tdx-quote.json
│   ├── invalid-tdx-quote.json
│   ├── valid-snp-report.json
│   └── invalid-snp-report.json
└── generators/                  # Test data generators
    ├── evidence-generator.ts
    ├── measurement-generator.ts
    └── certificate-generator.ts
```

---

## Intel TDX Mock

### Mock Quote Generator

The TDX mock generates realistic TDX quotes for testing.

```typescript
class MockTDXQuoteGenerator {
  /**
   * Generate a valid TDX quote
   */
  generateValidQuote(): TDXQuote {
    return {
      version: "2.0",
      tdId: this.generateTDId(),
      measurements: {
        mr_tdowner: this.generateMeasurement("tdowner"),
        mr_config: this.generateMeasurement("config"),
        mr_owner: this.generateMeasurement("owner"),
        mr_td: this.generateMeasurement("td")
      },
      tdxModuleInfo: {
        version: "1.0.0",
        securityVersion: 2
      },
      cpuidSecurityFeatures: this.generateCPUFeatures(),
      signature: this.generateSignature(),
      certificates: this.generateCertificateChain()
    };
  }
  
  /**
   * Generate an invalid signature quote
   */
  generateInvalidSignatureQuote(): TDXQuote {
    const quote = this.generateValidQuote();
    quote.signature = this.generateInvalidSignature();
    return quote;
  }
  
  /**
   * Generate an invalid measurement quote
   */
  generateInvalidMeasurementQuote(): TDXQuote {
    const quote = this.generateValidQuote();
    quote.measurements.mr_td = "invalid_measurement_hash";
    return quote;
  }
  
  /**
   * Generate an expired quote
   */
  generateExpiredQuote(): TDXQuote {
    const quote = this.generateValidQuote();
    quote.timestamp = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    return quote;
  }
  
  /**
   * Generate a malformed quote
   */
  generateMalformedQuote(): any {
    return {
      // Missing required fields
      version: "2.0",
      // tdId missing
      measurements: {
        // Incomplete measurements
      }
    };
  }
  
  private generateTDId(): string {
    return `td-${crypto.randomBytes(16).toString('hex')}`;
  }
  
  private generateMeasurement(type: string): string {
    const data = `${type}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  private generateCPUFeatures(): any {
    return {
      tdxEnabled: true,
      mktmeEnabled: true,
      securityVersion: 2
    };
  }
  
  private generateSignature(): any {
    return {
      algorithm: "ECDSA_P256",
      value: crypto.randomBytes(64),
      certificateId: "intel-tdx-cert-001"
    };
  }
  
  private generateInvalidSignature(): any {
    return {
      algorithm: "ECDSA_P256",
      value: crypto.randomBytes(32), // Wrong length
      certificateId: "intel-tdx-cert-001"
    };
  }
  
  private generateCertificateChain(): any[] {
    return [
      {
        raw: crypto.randomBytes(256),
        subject: "CN=Intel TDX Attestation",
        issuer: "CN=Intel Root CA",
        notBefore: Date.now() - (365 * 24 * 60 * 60 * 1000),
        notAfter: Date.now() + (365 * 24 * 60 * 60 * 1000),
        fingerprint: crypto.randomBytes(32).toString('hex')
      }
    ];
  }
}
```

### Mock Quote Parser

The TDX mock parser validates and parses TDX quotes.

```typescript
class MockTDXQuoteParser {
  /**
   * Parse and validate a TDX quote
   */
  parseQuote(quote: any): ValidationResult<TDXQuote> {
    // Check required fields
    if (!quote.version) {
      return ValidationResult.error("Missing version field");
    }
    
    if (!quote.tdId) {
      return ValidationResult.error("Missing tdId field");
    }
    
    if (!quote.measurements) {
      return ValidationResult.error("Missing measurements field");
    }
    
    if (!quote.signature) {
      return ValidationResult.error("Missing signature field");
    }
    
    // Validate measurements structure
    const requiredMeasurements = ['mr_tdowner', 'mr_config', 'mr_owner', 'mr_td'];
    for (const field of requiredMeasurements) {
      if (!quote.measurements[field]) {
        return ValidationResult.error(`Missing measurement: ${field}`);
      }
    }
    
    // Validate signature structure
    if (!quote.signature.algorithm || !quote.signature.value) {
      return ValidationResult.error("Invalid signature structure");
    }
    
    // If all validations pass, return success
    return ValidationResult.success(quote as TDXQuote);
  }
  
  /**
   * Extract measurements from quote
   */
  extractMeasurements(quote: TDXQuote): TeeMeasurements {
    return {
      boot: {
        firmware: quote.measurements.mr_tdowner,
        bootloader: quote.measurements.mr_config,
        kernel: quote.measurements.mr_td
      },
      config: {
        system: quote.measurements.mr_config,
        application: quote.measurements.mr_owner
      },
      runtime: {
        code: quote.measurements.mr_td,
        state: quote.measurements.mr_td
      }
    };
  }
  
  /**
   * Validate signature format
   */
  validateSignatureFormat(signature: any): boolean {
    if (!signature.algorithm) return false;
    if (!signature.value) return false;
    if (signature.value.length !== 64) return false; // ECDSA P256 signature length
    return true;
  }
}
```

### Mock TDX Verifier

The TDX mock verifier simulates quote verification.

```typescript
class MockTDXVerifier {
  private parser: MockTDXQuoteParser;
  private expectedMeasurements: Map<string, string>;
  
  constructor(expectedMeasurements?: Map<string, string>) {
    this.parser = new MockTDXQuoteParser();
    this.expectedMeasurements = expectedMeasurements || new Map();
  }
  
  /**
   * Verify a TDX quote
   */
  async verifyQuote(quote: any): Promise<VerificationResult> {
    // Parse quote
    const parseResult = this.parser.parseQuote(quote);
    if (!parseResult.valid) {
      return VerificationResult.invalid(parseResult.error);
    }
    
    const parsedQuote = parseResult.data;
    
    // Validate signature
    if (!this.parser.validateSignatureFormat(parsedQuote.signature)) {
      return VerificationResult.invalid("Invalid signature format");
    }
    
    // Validate measurements
    const measurementResult = this.validateMeasurements(parsedQuote);
    if (!measurementResult.valid) {
      return VerificationResult.invalid(measurementResult.error);
    }
    
    // Check freshness
    const freshnessResult = this.checkFreshness(parsedQuote);
    if (!freshnessResult.valid) {
      return VerificationResult.invalid(freshnessResult.error);
    }
    
    return VerificationResult.valid();
  }
  
  /**
   * Validate measurements against expected values
   */
  private validateMeasurements(quote: TDXQuote): VerificationResult {
    if (this.expectedMeasurements.size === 0) {
      // No expected measurements set, skip validation
      return VerificationResult.valid();
    }
    
    const expected = this.expectedMeasurements.get('mr_td');
    if (expected && quote.measurements.mr_td !== expected) {
      return VerificationResult.invalid("Measurement mismatch");
    }
    
    return VerificationResult.valid();
  }
  
  /**
   * Check quote freshness
   */
  private checkFreshness(quote: TDXQuote): VerificationResult {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const quoteAge = Date.now() - (quote.timestamp || Date.now());
    
    if (quoteAge > maxAge) {
      return VerificationResult.invalid("Quote expired");
    }
    
    return VerificationResult.valid();
  }
}
```

### Test Cases

```typescript
class TDXTestCases {
  private generator: MockTDXQuoteGenerator;
  private verifier: MockTDXVerifier;
  
  constructor() {
    this.generator = new MockTDXQuoteGenerator();
    this.verifier = new MockTDXVerifier();
  }
  
  /**
   * Test case: Valid quote
   */
  async testValidQuote(): Promise<TestResult> {
    const quote = this.generator.generateValidQuote();
    const result = await this.verifier.verifyQuote(quote);
    
    return {
      testCase: "VALID_TDX_QUOTE",
      expected: true,
      actual: result.valid,
      passed: result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Invalid signature
   */
  async testInvalidSignature(): Promise<TestResult> {
    const quote = this.generator.generateInvalidSignatureQuote();
    const result = await this.verifier.verifyQuote(quote);
    
    return {
      testCase: "INVALID_SIGNATURE",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Invalid measurement
   */
  async testInvalidMeasurement(): Promise<TestResult> {
    const quote = this.generator.generateInvalidMeasurementQuote();
    const result = await this.verifier.verifyQuote(quote);
    
    return {
      testCase: "INVALID_MEASUREMENT",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Expired quote
   */
  async testExpiredQuote(): Promise<TestResult> {
    const quote = this.generator.generateExpiredQuote();
    const result = await this.verifier.verifyQuote(quote);
    
    return {
      testCase: "EXPIRED_QUOTE",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Malformed quote
   */
  async testMalformedQuote(): Promise<TestResult> {
    const quote = this.generator.generateMalformedQuote();
    const result = await this.verifier.verifyQuote(quote);
    
    return {
      testCase: "MALFORMED_QUOTE",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Run all test cases
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testValidQuote(),
      this.testInvalidSignature(),
      this.testInvalidMeasurement(),
      this.testExpiredQuote(),
      this.testMalformedQuote()
    ];
    
    return Promise.all(tests);
  }
}
```

---

## AMD SEV-SNP Mock

### Mock Report Generator

```typescript
class MockSNPReportGenerator {
  /**
   * Generate a valid SEV-SNP report
   */
  generateValidReport(): SNPReport {
    return {
      version: "1.0",
      guest_svn: 1,
      policy: this.generatePolicy(),
      family_id: this.generateFamilyId(),
      image_id: this.generateImageId(),
      measurement: this.generateMeasurement(),
      launch_measurement: this.generateLaunchMeasurement(),
      host_data: this.generateHostData(),
      id_key_digest: this.generateIdKeyDigest(),
      author_key_digest: this.generateAuthorKeyDigest(),
      report_id: this.generateReportId(),
      signature: this.generateSignature(),
      certificates: this.generateCertificateChain()
    };
  }
  
  /**
   * Generate an invalid signature report
   */
  generateInvalidSignatureReport(): SNPReport {
    const report = this.generateValidReport();
    report.signature = this.generateInvalidSignature();
    return report;
  }
  
  /**
   * Generate an invalid policy report
   */
  generateInvalidPolicyReport(): SNPReport {
    const report = this.generateValidReport();
    report.policy = 0xFFFFFFFF; // Invalid policy value
    return report;
  }
  
  /**
   * Generate an invalid measurement report
   */
  generateInvalidMeasurementReport(): SNPReport {
    const report = this.generateValidReport();
    report.measurement = "invalid_measurement_hash";
    return report;
  }
  
  private generatePolicy(): number {
    return 0x00000001; // Valid policy
  }
  
  private generateFamilyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  private generateImageId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  private generateMeasurement(): string {
    const data = `measurement-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  private generateLaunchMeasurement(): string {
    const data = `launch-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  private generateHostData(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  private generateIdKeyDigest(): string {
    const data = `idkey-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  private generateAuthorKeyDigest(): string {
    const data = `authorkey-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  private generateReportId(): string {
    return crypto.randomBytes(96).toString('hex');
  }
  
  private generateSignature(): any {
    return {
      algorithm: "ECDSA_P384",
      value: crypto.randomBytes(96),
      certificateId: "amd-snp-cert-001"
    };
  }
  
  private generateInvalidSignature(): any {
    return {
      algorithm: "ECDSA_P384",
      value: crypto.randomBytes(48), // Wrong length
      certificateId: "amd-snp-cert-001"
    };
  }
  
  private generateCertificateChain(): any[] {
    return [
      {
        raw: crypto.randomBytes(256),
        subject: "CN=AMD SEV-SNP Attestation",
        issuer: "CN=AMD Root CA",
        notBefore: Date.now() - (365 * 24 * 60 * 60 * 1000),
        notAfter: Date.now() + (365 * 24 * 60 * 60 * 1000),
        fingerprint: crypto.randomBytes(32).toString('hex')
      }
    ];
  }
}
```

### Mock Report Parser

```typescript
class MockSNPReportParser {
  /**
   * Parse and validate a SEV-SNP report
   */
  parseReport(report: any): ValidationResult<SNPReport> {
    // Check required fields
    if (!report.version) {
      return ValidationResult.error("Missing version field");
    }
    
    if (!report.guest_svn) {
      return ValidationResult.error("Missing guest_svn field");
    }
    
    if (!report.policy) {
      return ValidationResult.error("Missing policy field");
    }
    
    if (!report.measurement) {
      return ValidationResult.error("Missing measurement field");
    }
    
    if (!report.signature) {
      return ValidationResult.error("Missing signature field");
    }
    
    // Validate signature structure
    if (!report.signature.algorithm || !report.signature.value) {
      return ValidationResult.error("Invalid signature structure");
    }
    
    // If all validations pass, return success
    return ValidationResult.success(report as SNPReport);
  }
  
  /**
   * Extract measurements from report
   */
  extractMeasurements(report: SNPReport): TeeMeasurements {
    return {
      boot: {
        firmware: report.measurement,
        bootloader: report.launch_measurement,
        kernel: report.measurement
      },
      config: {
        system: report.policy.toString(),
        application: report.id_key_digest
      },
      runtime: {
        code: report.measurement,
        state: report.measurement
      }
    };
  }
  
  /**
   * Validate policy format
   */
  validatePolicyFormat(policy: number): boolean {
    // Valid policy is a 32-bit value
    return policy >= 0 && policy <= 0xFFFFFFFF;
  }
}
```

### Mock SNP Verifier

```typescript
class MockSNPVerifier {
  private parser: MockSNPReportParser;
  private expectedMeasurements: Map<string, string>;
  
  constructor(expectedMeasurements?: Map<string, string>) {
    this.parser = new MockSNPReportParser();
    this.expectedMeasurements = expectedMeasurements || new Map();
  }
  
  /**
   * Verify a SEV-SNP report
   */
  async verifyReport(report: any): Promise<VerificationResult> {
    // Parse report
    const parseResult = this.parser.parseReport(report);
    if (!parseResult.valid) {
      return VerificationResult.invalid(parseResult.error);
    }
    
    const parsedReport = parseResult.data;
    
    // Validate policy
    if (!this.parser.validatePolicyFormat(parsedReport.policy)) {
      return VerificationResult.invalid("Invalid policy format");
    }
    
    // Validate signature
    if (!this.validateSignatureFormat(parsedReport.signature)) {
      return VerificationResult.invalid("Invalid signature format");
    }
    
    // Validate measurements
    const measurementResult = this.validateMeasurements(parsedReport);
    if (!measurementResult.valid) {
      return VerificationResult.invalid(measurementResult.error);
    }
    
    return VerificationResult.valid();
  }
  
  /**
   * Validate measurements against expected values
   */
  private validateMeasurements(report: SNPReport): VerificationResult {
    if (this.expectedMeasurements.size === 0) {
      // No expected measurements set, skip validation
      return VerificationResult.valid();
    }
    
    const expected = this.expectedMeasurements.get('measurement');
    if (expected && report.measurement !== expected) {
      return VerificationResult.invalid("Measurement mismatch");
    }
    
    return VerificationResult.valid();
  }
  
  /**
   * Validate signature format
   */
  private validateSignatureFormat(signature: any): boolean {
    if (!signature.algorithm) return false;
    if (!signature.value) return false;
    if (signature.value.length !== 96) return false; // ECDSA P384 signature length
    return true;
  }
}
```

### Test Cases

```typescript
class SNPTestCases {
  private generator: MockSNPReportGenerator;
  private verifier: MockSNPVerifier;
  
  constructor() {
    this.generator = new MockSNPReportGenerator();
    this.verifier = new MockSNPVerifier();
  }
  
  /**
   * Test case: Valid report
   */
  async testValidReport(): Promise<TestResult> {
    const report = this.generator.generateValidReport();
    const result = await this.verifier.verifyReport(report);
    
    return {
      testCase: "VALID_SNP_REPORT",
      expected: true,
      actual: result.valid,
      passed: result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Invalid signature
   */
  async testInvalidSignature(): Promise<TestResult> {
    const report = this.generator.generateInvalidSignatureReport();
    const result = await this.verifier.verifyReport(report);
    
    return {
      testCase: "INVALID_SIGNATURE",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Invalid policy
   */
  async testInvalidPolicy(): Promise<TestResult> {
    const report = this.generator.generateInvalidPolicyReport();
    const result = await this.verifier.verifyReport(report);
    
    return {
      testCase: "INVALID_POLICY",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Test case: Invalid measurement
   */
  async testInvalidMeasurement(): Promise<TestResult> {
    const report = this.generator.generateInvalidMeasurementReport();
    const result = await this.verifier.verifyReport(report);
    
    return {
      testCase: "INVALID_MEASUREMENT",
      expected: false,
      actual: result.valid,
      passed: !result.valid,
      details: result
    };
  }
  
  /**
   * Run all test cases
   */
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testValidReport(),
      this.testInvalidSignature(),
      this.testInvalidPolicy(),
      this.testInvalidMeasurement()
    ];
    
    return Promise.all(tests);
  }
}
```

---

## Usage Examples

### Using TDX Mock

```typescript
// Create generator and verifier
const tdxGenerator = new MockTDXQuoteGenerator();
const tdxVerifier = new MockTDXVerifier();

// Generate a valid quote
const validQuote = tdxGenerator.generateValidQuote();
const result = await tdxVerifier.verifyQuote(validQuote);
console.log(`Verification result: ${result.valid}`);

// Generate an invalid quote
const invalidQuote = tdxGenerator.generateInvalidSignatureQuote();
const invalidResult = await tdxVerifier.verifyQuote(invalidQuote);
console.log(`Invalid quote verification: ${invalidResult.valid}`);

// Run test cases
const tdxTests = new TDXTestCases();
const testResults = await tdxTests.runAllTests();
console.log('TDX Test Results:', testResults);
```

### Using SEV-SNP Mock

```typescript
// Create generator and verifier
const snpGenerator = new MockSNPReportGenerator();
const snpVerifier = new MockSNPVerifier();

// Generate a valid report
const validReport = snpGenerator.generateValidReport();
const result = await snpVerifier.verifyReport(validReport);
console.log(`Verification result: ${result.valid}`);

// Generate an invalid report
const invalidReport = snpGenerator.generateInvalidSignatureReport();
const invalidResult = await snpVerifier.verifyReport(invalidReport);
console.log(`Invalid report verification: ${invalidResult.valid}`);

// Run test cases
const snpTests = new SNPTestCases();
const testResults = await snpTests.runAllTests();
console.log('SNP Test Results:', testResults);
```

---

## Safety boundaries

### No hardware access
- Never attempts TEE hardware access
- All operations are in-memory simulations
- No system calls to TEE devices

### No network access
- Never connects to external services
- No Intel Quote Service calls
- No AMD certificate service calls

### No cryptographic operations
- Mock signatures are random bytes
- Mock certificates are randomly generated
- No real cryptographic key operations

### Isolation from production
- Separate from production systems
- No access to production keys or certificates
- No interaction with production TEE services

---

## Next steps

- Implement mock providers in TypeScript/Go
- Add adapter integration tests
- Validate against real TEE behavior documentation
