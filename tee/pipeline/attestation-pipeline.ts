import { TeeRuntimeConfig } from '../config/tee-runtime-config.js';
import { AttestationError, AttestationErrorCode } from '../domain/attestation-error.js';
import { err, ok, Result } from '../domain/attestation-result.js';
import { TeeVerificationResult } from '../domain/tee-verification-result.js';
import { VerificationLevel } from '../domain/verification-level.js';
import { ClaimsGate } from '../integration/claims-gate.js';
import { TeeClaims } from '../integration/zk-claims-mapper.js';
import { EvidenceNormalizer, NormalizedEvidence } from '../mock/evidence-normalizer.js';
import { Evidence } from '../mock/provider-interface.js';
import {
  RealEvidenceNormalizer,
  RealNormalizedEvidence,
} from '../normalizers/real-evidence-normalizer.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import { VerificationFactory } from '../verification/verification-factory.js';

export interface PipelineInput {
  readonly providerType: 'TDX' | 'SEV-SNP';
  readonly reportData: Buffer;
  readonly path: 'mock' | 'real';
  readonly enableClaims: boolean;
}

export interface PipelineOutput {
  readonly evidence: Evidence;
  readonly verification: TeeVerificationResult;
  readonly normalized?: NormalizedEvidence | RealNormalizedEvidence;
  readonly claims?: TeeClaims;
  readonly policyPassed?: boolean;
}

export interface VerificationPolicy {
  allows(level: VerificationLevel): boolean;
}

export interface PipelineDependencies {
  readonly config: TeeRuntimeConfig;
  readonly providerFactory: typeof ProviderFactory;
  readonly verificationFactory: typeof VerificationFactory;
  readonly mockNormalizer: typeof EvidenceNormalizer;
  readonly realNormalizer: typeof RealEvidenceNormalizer;
  readonly claimsGate: typeof ClaimsGate;
  readonly verificationPolicy: VerificationPolicy;
}

function toAttestationError(
  code: AttestationErrorCode,
  message: string,
  layer: AttestationError['layer'],
): AttestationError {
  return { code, message, layer };
}

function mockPathVerification(provider: PipelineInput['providerType']): TeeVerificationResult {
  return {
    isValid: false,
    provider,
    tcbStatus: 'Unknown',
    pocScope: 'verification-stub',
    verificationLevel: VerificationLevel.NONE,
    message: 'Mock path; claims generation disabled',
  };
}

/**
 * Phase 8.9C-pre.4 attestation pipeline orchestrator.
 * Compose only — delegates all business logic to existing components.
 */
export class AttestationPipeline {
  static async run(
    input: PipelineInput,
    deps: PipelineDependencies,
  ): Promise<Result<PipelineOutput>> {
    if (input.path === 'mock') {
      return this.runMockPath(input, deps);
    }
    return this.runRealPath(input, deps);
  }

  private static async runMockPath(
    input: PipelineInput,
    deps: PipelineDependencies,
  ): Promise<Result<PipelineOutput>> {
    let evidence: Evidence;
    try {
      const provider = deps.providerFactory.getProvider(input.providerType);
      evidence = await provider.generateEvidence(input.reportData);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Provider evidence generation failed';
      return err(toAttestationError(AttestationErrorCode.DEVICE_UNAVAILABLE, message, 'acquisition'));
    }

    let normalized: NormalizedEvidence;
    try {
      normalized = deps.mockNormalizer.normalize(evidence);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Mock normalization failed';
      return err(toAttestationError(AttestationErrorCode.STRUCTURE_INVALID, message, 'normalize'));
    }

    return ok({
      evidence,
      verification: mockPathVerification(input.providerType),
      normalized,
      policyPassed: false,
    });
  }

  private static async runRealPath(
    input: PipelineInput,
    deps: PipelineDependencies,
  ): Promise<Result<PipelineOutput>> {
    let evidence: Evidence;
    try {
      const provider = deps.providerFactory.getProvider(input.providerType);
      evidence = await provider.generateEvidence(input.reportData);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Provider evidence generation failed';
      return err(toAttestationError(AttestationErrorCode.DEVICE_UNAVAILABLE, message, 'acquisition'));
    }

    const verifier =
      input.providerType === 'TDX'
        ? deps.verificationFactory.getTdxVerifier()
        : deps.verificationFactory.getSevVerifier();
    const verification = verifier.verify(evidence.rawReport);

    let normalized: RealNormalizedEvidence;
    try {
      normalized = deps.realNormalizer.normalize(evidence);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Real normalization failed';
      return err(toAttestationError(AttestationErrorCode.STRUCTURE_INVALID, message, 'normalize'));
    }

    const policyPassed = deps.verificationPolicy.allows(verification.verificationLevel);

    if (!input.enableClaims) {
      return ok({
        evidence,
        verification,
        normalized,
        policyPassed,
      });
    }

    const claimsResult = deps.claimsGate.toClaims(normalized, verification, evidence.rawReport);
    if (!claimsResult.ok) {
      return err(claimsResult.error);
    }

    return ok({
      evidence,
      verification,
      normalized,
      claims: claimsResult.value,
      policyPassed,
    });
  }
}
