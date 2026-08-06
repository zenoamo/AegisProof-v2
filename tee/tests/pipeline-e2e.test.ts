import assert from 'assert';
import { loadTeeRuntimeConfig } from '../config/tee-runtime-config.js';
import { AttestationErrorCode } from '../domain/attestation-error.js';
import { VerificationLevel } from '../domain/verification-level.js';
import { ClaimsGate } from '../integration/claims-gate.js';
import { EvidenceNormalizer } from '../mock/evidence-normalizer.js';
import { RealEvidenceNormalizer } from '../normalizers/real-evidence-normalizer.js';
import {
  AttestationPipeline,
  PipelineDependencies,
  PipelineInput,
} from '../pipeline/attestation-pipeline.js';
import { DEFAULT_VERIFICATION_LEVEL_POLICY } from '../policy/verification-policy.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import { VerificationFactory } from '../verification/verification-factory.js';
import {
  OfflineCollateralLoader,
  bufferFromFixtureHex,
} from '../verification/offline-collateral-loader.js';

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    const value = vars[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return fn().finally(() => {
    for (const key of Object.keys(saved)) {
      const value = saved[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

function defaultDeps(env: NodeJS.ProcessEnv = process.env): PipelineDependencies {
  return {
    config: loadTeeRuntimeConfig(env),
    providerFactory: ProviderFactory,
    verificationFactory: VerificationFactory,
    mockNormalizer: EvidenceNormalizer,
    realNormalizer: RealEvidenceNormalizer,
    claimsGate: ClaimsGate,
    verificationPolicy: DEFAULT_VERIFICATION_LEVEL_POLICY,
  };
}

function depsWithStaticEvidence(
  rawReport: Buffer,
  providerType: 'TDX' | 'SEV-SNP' = 'TDX',
  env: NodeJS.ProcessEnv = process.env,
): PipelineDependencies {
  return {
    ...defaultDeps(env),
    providerFactory: {
      getProvider: () => ({
        generateEvidence: async () => ({ providerType, rawReport }),
        verifyEvidence: async () => true,
        simulateError: () => {},
      }),
    } as typeof ProviderFactory,
  };
}

async function runTests() {
  console.log('--- Pipeline E2E Tests (Phase 8.9C-pre.4) ---');

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: undefined }, async () => {
    const mockInput: PipelineInput = {
      providerType: 'TDX',
      reportData: Buffer.from('pipeline-mock'),
      path: 'mock',
      enableClaims: false,
    };
    const mockResult = await AttestationPipeline.run(mockInput, defaultDeps());
    assert.strictEqual(mockResult.ok, true);
    if (mockResult.ok) {
      assert.strictEqual(mockResult.value.normalized?.isMock, true);
      assert.strictEqual(mockResult.value.verification.verificationLevel, VerificationLevel.NONE);
      assert.strictEqual(mockResult.value.claims, undefined);
    }
  });

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: undefined }, async () => {
    const tdxBuffer = Buffer.alloc(48);
    tdxBuffer.writeUInt16LE(4, 0);
    const realInput: PipelineInput = {
      providerType: 'TDX',
      reportData: tdxBuffer,
      path: 'real',
      enableClaims: false,
    };
    const realResult = await AttestationPipeline.run(
      realInput,
      depsWithStaticEvidence(tdxBuffer, 'TDX', { TEE_VERIFICATION: undefined }),
    );
    assert.strictEqual(realResult.ok, true);
    if (realResult.ok) {
      assert.strictEqual(realResult.value.normalized?.isMock, false);
      assert.strictEqual(
        realResult.value.verification.verificationLevel,
        VerificationLevel.STRUCTURE_ONLY,
      );
    }
  });

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: undefined }, async () => {
    const tdxBuffer = Buffer.alloc(48);
    tdxBuffer.writeUInt16LE(4, 0);
    const noClaims = await AttestationPipeline.run(
      {
        providerType: 'TDX',
        reportData: tdxBuffer,
        path: 'real',
        enableClaims: false,
      },
      depsWithStaticEvidence(tdxBuffer, 'TDX', { TEE_VERIFICATION: undefined }),
    );
    assert.strictEqual(noClaims.ok, true);
    if (noClaims.ok) {
      assert.strictEqual(noClaims.value.claims, undefined);
    }
  });

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: 'offline' }, async () => {
    const tdxBundle = OfflineCollateralLoader.loadTdxBundle();
    const tdxQuote = bufferFromFixtureHex(tdxBundle.quote.quoteHex);
    const withClaims = await AttestationPipeline.run(
      {
        providerType: 'TDX',
        reportData: tdxQuote,
        path: 'real',
        enableClaims: true,
      },
      depsWithStaticEvidence(tdxQuote, 'TDX', { TEE_VERIFICATION: 'offline' }),
    );
    assert.strictEqual(withClaims.ok, true);
    if (withClaims.ok) {
      assert.strictEqual(withClaims.value.claims?.teeProviderId, 'TDX');
      assert.strictEqual(withClaims.value.policyPassed, true);
    }
  });

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: 'offline' }, async () => {
    const tdxInvalidFixture = OfflineCollateralLoader.loadTdxQuote('tdx/quote-invalid.json');
    const tdxBad = bufferFromFixtureHex(tdxInvalidFixture.quoteHex);
    const invalid = await AttestationPipeline.run(
      {
        providerType: 'TDX',
        reportData: tdxBad,
        path: 'real',
        enableClaims: true,
      },
      depsWithStaticEvidence(tdxBad, 'TDX', { TEE_VERIFICATION: 'offline' }),
    );
    assert.strictEqual(invalid.ok, false);
    if (!invalid.ok) {
      assert.strictEqual(invalid.error.code, AttestationErrorCode.VERIFY_FAILED);
    }
  });

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: undefined }, async () => {
    const mockClaims = await AttestationPipeline.run(
      {
        providerType: 'TDX',
        reportData: Buffer.from('pipeline-mock-claims'),
        path: 'mock',
        enableClaims: true,
      },
      defaultDeps(),
    );
    assert.strictEqual(mockClaims.ok, true);
    if (mockClaims.ok) {
      assert.strictEqual(mockClaims.value.claims, undefined);
      assert.strictEqual(mockClaims.value.verification.verificationLevel, VerificationLevel.NONE);
    }
  });

  await withEnv({ TEE_ENV: undefined, TEE_VERIFICATION: undefined }, async () => {
    const tdxBuffer = Buffer.alloc(48);
    tdxBuffer.writeUInt16LE(4, 0);
    const policyDeny = await AttestationPipeline.run(
      {
        providerType: 'TDX',
        reportData: tdxBuffer,
        path: 'real',
        enableClaims: false,
      },
      depsWithStaticEvidence(tdxBuffer, 'TDX', { TEE_VERIFICATION: undefined }),
    );
    assert.strictEqual(policyDeny.ok, true);
    if (policyDeny.ok) {
      assert.strictEqual(policyDeny.value.policyPassed, false);
    }
  });

  const errorDeps: PipelineDependencies = {
    ...defaultDeps({}),
    providerFactory: {
      getProvider: () => ({
        generateEvidence: async () => {
          throw new Error('Simulated device unavailable');
        },
        verifyEvidence: async () => true,
        simulateError: () => {},
      }),
    } as typeof ProviderFactory,
  };
  const errorResult = await AttestationPipeline.run(
    {
      providerType: 'TDX',
      reportData: Buffer.alloc(48),
      path: 'real',
      enableClaims: false,
    },
    errorDeps,
  );
  assert.strictEqual(errorResult.ok, false);
  if (!errorResult.ok) {
    assert.strictEqual(errorResult.error.code, AttestationErrorCode.DEVICE_UNAVAILABLE);
  }

  console.log('✅ pipeline-e2e.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ pipeline-e2e.test.ts failed', e);
  process.exit(1);
});
