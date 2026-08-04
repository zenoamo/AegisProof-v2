// GENERATED FILE — do not edit. Source: specs/aegis-protocol.v2.json
// Regenerate: node scripts/codegen_signals.mjs

export const PROTOCOL_VERSION = 2 as const;
export const DOMAIN_NULLIFIER_V2 = 20148535406093122816468858649806210947444276317485944952083069500197208546562n; // NUS-derived; see SSoT domainSeparation
export const MAX_AGE_SECONDS = 86400 as const;
export const CLOCK_SKEW_SECONDS = 300 as const;

// Canonical public-signal indices (Groth16 publicSignals array positions)
export const SIGNAL_INDEX = {
  expectedPromptRoot: 0,
  expectedOutputRoot: 1,
  sessionId: 2,
  purposeId: 3,
  weightsHash: 4,
  tokenizerHash: 5,
  systemPromptHash: 6,
  loraHash: 7,
  adapterHash: 8,
  safetyLayerHash: 9,
  quantizationHash: 10,
  precisionHash: 11,
  runtimeHash: 12,
  driverHash: 13,
  temperature: 14,
  topP: 15,
  topK: 16,
  seed: 17,
  repetitionPenalty: 18,
  presencePenalty: 19,
  frequencyPenalty: 20,
  maxTokens: 21,
  chainId: 22,
  protocolVersion: 23,
  timestamp: 24,
  modelManifestCommitment: 25,
  executionEnvCommitment: 26,
  generationCommitment: 27,
  commitment: 28,
  nullifier: 29,
} as const;

export const N_PUBLIC_SIGNALS = 30 as const;

export const COMMITMENT_INPUTS = [
  "expectedPromptRoot",
  "expectedOutputRoot",
  "modelManifestCommitment",
  "executionEnvCommitment",
  "generationCommitment",
  "protocolVersion",
] as const;

export const NULLIFIER_INPUTS = [
  "DOMAIN_NULLIFIER_V2",
  "secretKey",
  "deviceId",
  "purposeId",
  "sessionId",
  "commitment",
  "protocolVersion",
  "chainId",
] as const;
