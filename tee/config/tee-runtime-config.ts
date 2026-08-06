export type TeeEnvMode = 'mock' | 'tdx' | 'sev-snp';
export type TeeAcquisitionMode = 'default' | 'experimental';
export type TeeVerificationMode = 'stub' | 'offline';

/**
 * Phase 8.9C-pre.2 canonical runtime configuration.
 * Parsed from TEE_* environment variables; unknown values fall back to safe defaults.
 */
export interface TeeRuntimeConfig {
  readonly env: TeeEnvMode;
  readonly acquisition: TeeAcquisitionMode;
  readonly verification: TeeVerificationMode;
}

function parseEnv(raw: string | undefined): TeeEnvMode {
  const value = raw?.trim().toLowerCase();
  if (!value || value === 'mock') {
    return 'mock';
  }
  if (value === 'tdx') {
    return 'tdx';
  }
  if (value === 'sev' || value === 'sev-snp') {
    return 'sev-snp';
  }
  return 'mock';
}

function parseAcquisition(raw: string | undefined): TeeAcquisitionMode {
  if (raw?.trim().toLowerCase() === 'experimental') {
    return 'experimental';
  }
  return 'default';
}

function parseVerification(raw: string | undefined): TeeVerificationMode {
  if (raw?.trim().toLowerCase() === 'offline') {
    return 'offline';
  }
  return 'stub';
}

/** Load config from process.env (or an explicit env snapshot for tests). */
export function loadTeeRuntimeConfig(source: NodeJS.ProcessEnv = process.env): TeeRuntimeConfig {
  return {
    env: parseEnv(source.TEE_ENV),
    acquisition: parseAcquisition(source.TEE_ACQUISITION),
    verification: parseVerification(source.TEE_VERIFICATION),
  };
}
