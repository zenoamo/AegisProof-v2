// ============================================================================
// KMS/HSM signer abstraction (Phase 8.14 Task 2)
// ----------------------------------------------------------------------------
// Provenance + operator auth signing via pluggable backends.
// Does NOT touch Groth16 path. No private key export. No persistent secrets.
// ============================================================================
import crypto from "crypto";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import {
  PROVENANCE_DOMAIN,
  PQC_ALGORITHM,
  PQC_ALGORITHM_VERSION,
  PQC_VERSION,
  buildSignMessage,
  bytesToHex,
  hexToBytes,
  verifyEnvelope,
} from "./pqc-signature.mjs";
import {
  AUTH_ENVELOPE_DOMAIN,
  CLASSICAL_ALGORITHM,
  CLASSICAL_CURVE,
  buildAuthSignMessage,
  verifyClassical,
  verifyPqcAuth,
} from "./hybrid-auth-envelope.mjs";
import {
  loadRegistryPublicKey,
  REGISTRY_ALGORITHM,
  REGISTRY_VERSION,
} from "./public-key-registry.mjs";
import {
  isVaultTransitConfigured,
  vaultTransitSign,
  vaultTransitVerify,
  vaultTransitStubSignature,
  resolveTransitKeyNameForKeyId,
  inferVaultHashAlgorithm,
} from "./kms-backends/vault-transit.mjs";
import {
  isCloudHsmConfigured,
  cloudHsmSign,
  cloudHsmVerifyHttp,
  CloudHsmError,
} from "./kms-backends/cloud-hsm.mjs";
import { isExplicitLiveMode, isVaultForceLive, validateCloudHsmEnv } from "./kms-backends/env.mjs";
import { isLocalOpenSslConfigured, localOpenSslSign, localOpenSslVerify } from "./kms-backends/local-openssl.mjs";

export const BACKEND_MOCK_HSM = "mock-hsm";
export const BACKEND_VAULT_TRANSIT = "vault-transit";
export const BACKEND_CLOUD_HSM = "cloud-hsm";
export const BACKEND_LOCAL_OPENSSL = "local-openssl";

export const SIGNER_ROLE_PROVENANCE = "provenance";
export const SIGNER_ROLE_OPERATOR_PQC = "operator-pqc";
export const SIGNER_ROLE_OPERATOR_CLASSICAL = "operator-classical";

export const SUPPORTED_BACKENDS = [BACKEND_MOCK_HSM, BACKEND_VAULT_TRANSIT, BACKEND_CLOUD_HSM, BACKEND_LOCAL_OPENSSL];

const ROLE_DOMAINS = {
  [SIGNER_ROLE_PROVENANCE]: PROVENANCE_DOMAIN,
  [SIGNER_ROLE_OPERATOR_PQC]: AUTH_ENVELOPE_DOMAIN,
  [SIGNER_ROLE_OPERATOR_CLASSICAL]: AUTH_ENVELOPE_DOMAIN,
};

const ROLE_ALGORITHMS = {
  [SIGNER_ROLE_PROVENANCE]: PQC_ALGORITHM,
  [SIGNER_ROLE_OPERATOR_PQC]: PQC_ALGORITHM,
  [SIGNER_ROLE_OPERATOR_CLASSICAL]: CLASSICAL_ALGORITHM,
};

/** Test-only in-memory slot store — never persisted, never exported. */
const mockHsmSlots = new Map();

export class KmsSecurityError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "KmsSecurityError";
    this.code = code;
  }
}

/**
 * @param {object} config
 * @param {string} config.backend
 * @param {string} config.keyId
 * @param {string} config.role
 * @param {string} [config.algorithm]
 * @param {string} [config.domain]
 */
export function verifySignerConfiguration(config) {
  const errors = [];

  if (!config || typeof config !== "object") {
    return { ok: false, errors: ["configuration must be an object"] };
  }

  if (!config.backend || !SUPPORTED_BACKENDS.includes(config.backend)) {
    errors.push(`unsupported backend: ${config.backend ?? "missing"}`);
  }

  if (!config.keyId || typeof config.keyId !== "string") {
    errors.push("keyId required");
  }

  if (!config.role || !ROLE_DOMAINS[config.role]) {
    errors.push(`unsupported role: ${config.role ?? "missing"}`);
  }

  const expectedDomain = ROLE_DOMAINS[config.role];
  const expectedAlgorithm = ROLE_ALGORITHMS[config.role];

  if (config.domain && config.domain !== expectedDomain) {
    errors.push(`domain mismatch for role ${config.role}: expected ${expectedDomain}`);
  }

  const algorithm = config.algorithm ?? expectedAlgorithm;
  if (algorithm !== expectedAlgorithm) {
    errors.push(`algorithm mismatch for role ${config.role}: expected ${expectedAlgorithm}, got ${algorithm}`);
  }

  if (config.backend === BACKEND_VAULT_TRANSIT || config.backend === BACKEND_CLOUD_HSM || config.backend === BACKEND_LOCAL_OPENSSL) {
    const record = loadRegistryPublicKey(config.keyId);
    if (!record) {
      errors.push(`unknown keyId in registry: ${config.keyId}`);
    } else if (config.role !== SIGNER_ROLE_OPERATOR_CLASSICAL && record.algorithm !== REGISTRY_ALGORITHM) {
      errors.push(`registry algorithm mismatch: ${record.algorithm}`);
    }
  }

  if (config.backend === BACKEND_MOCK_HSM && config.keyId && !config.keyId.startsWith("test-")) {
    errors.push("mock-hsm keyId must use test- prefix (unit tests only)");
  }

  return { ok: errors.length === 0, errors, normalized: normalizeConfig(config) };
}

/**
 * @param {object} config
 */
function normalizeConfig(config) {
  const role = config.role;
  return {
    backend: config.backend,
    keyId: config.keyId,
    role,
    algorithm: config.algorithm ?? ROLE_ALGORITHMS[role],
    domain: config.domain ?? ROLE_DOMAINS[role],
  };
}

/**
 * @param {object} config
 * @param {{ testKeyMaterial?: { publicKeyHex?: string, secretKey?: Uint8Array } }} [opts]
 */
export function createSigner(config, opts = {}) {
  const verified = verifySignerConfiguration(config);
  if (!verified.ok) {
    throw new KmsSecurityError("INVALID_CONFIG", verified.errors.join("; "));
  }

  const normalized = verified.normalized;

  if (normalized.backend === BACKEND_MOCK_HSM) {
    ensureMockSlot(normalized, opts.testKeyMaterial);
  }

  return {
    ...normalized,
    createdAt: new Date().toISOString(),
    exportAllowed: false,
  };
}

/**
 * @param {object} normalized
 * @param {{ publicKeyHex?: string, secretKey?: Uint8Array } | undefined} testKeyMaterial
 */
function ensureMockSlot(normalized, testKeyMaterial) {
  if (mockHsmSlots.has(normalized.keyId)) return;

  if (testKeyMaterial?.secretKey && testKeyMaterial?.publicKeyHex) {
    mockHsmSlots.set(normalized.keyId, {
      publicKeyHex: testKeyMaterial.publicKeyHex.replace(/^0x/, ""),
      secretKey: testKeyMaterial.secretKey,
    });
    return;
  }

  if (normalized.role === SIGNER_ROLE_OPERATOR_CLASSICAL) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: CLASSICAL_CURVE });
    mockHsmSlots.set(normalized.keyId, {
      publicKeyHex: bytesToHex(publicKey.export({ type: "spki", format: "der" })),
      privateKey,
      kind: "ecdsa",
    });
    return;
  }

  const { publicKey, secretKey } = ml_dsa87.keygen();
  mockHsmSlots.set(normalized.keyId, {
    publicKeyHex: bytesToHex(publicKey),
    secretKey,
    kind: "mldsa87",
  });
}

/**
 * Validate payload domain separation before signing.
 * @param {object} signer
 * @param {Record<string, unknown>} payload
 */
export function validatePayloadDomain(signer, payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload must be object" };
  }

  if (signer.role === SIGNER_ROLE_PROVENANCE) {
    if (payload.domain !== PROVENANCE_DOMAIN) {
      return { ok: false, error: `domain mismatch: expected ${PROVENANCE_DOMAIN}` };
    }
    return { ok: true, message: buildSignMessage(payload) };
  }

  if (payload.domain !== "AEGIS_DEPLOYMENT_AUTH_V1") {
    return { ok: false, error: `payload.domain mismatch: expected AEGIS_DEPLOYMENT_AUTH_V1` };
  }

  return { ok: true, message: buildAuthSignMessage(payload) };
}

/**
 * @param {object} signer
 */
export function getPublicKeyMetadata(signer) {
  if (!signer?.keyId) {
    throw new KmsSecurityError("INVALID_SIGNER", "signer keyId missing");
  }

  if (signer.backend === BACKEND_MOCK_HSM) {
    const slot = mockHsmSlots.get(signer.keyId);
    if (!slot) {
      throw new KmsSecurityError("UNKNOWN_KEY", `mock slot not found: ${signer.keyId}`);
    }
    return {
      keyId: signer.keyId,
      backend: signer.backend,
      role: signer.role,
      algorithm: signer.algorithm,
      domain: signer.domain,
      version: signer.role === SIGNER_ROLE_OPERATOR_CLASSICAL ? "v1" : PQC_VERSION,
      publicKey: slot.publicKeyHex,
      exportAllowed: false,
    };
  }

  if (signer.backend === BACKEND_VAULT_TRANSIT) {
    const record = loadRegistryPublicKey(signer.keyId);
    if (!record) {
      throw new KmsSecurityError("UNKNOWN_KEY", `unknown keyId: ${signer.keyId}`);
    }
    return {
      keyId: signer.keyId,
      backend: signer.backend,
      role: signer.role,
      algorithm: signer.algorithm,
      domain: signer.domain,
      version: record.version,
      publicKey: record.publicKey,
      purpose: record.purpose,
      exportAllowed: false,
      live: shouldUseVaultLive(),
    };
  }

  if (signer.backend === BACKEND_LOCAL_OPENSSL) {
    const record = loadRegistryPublicKey(signer.keyId);
    if (!record) throw new KmsSecurityError("UNKNOWN_KEY", `unknown keyId: ${signer.keyId}`);
    return { keyId: signer.keyId, backend: signer.backend, role: signer.role, algorithm: signer.algorithm, domain: signer.domain, version: record.version, publicKey: record.publicKey, purpose: record.purpose, exportAllowed: false, live: isLocalOpenSslConfigured() };
  }

  if (signer.backend === BACKEND_CLOUD_HSM) {
    const record = loadRegistryPublicKey(signer.keyId);
    if (!record) {
      throw new KmsSecurityError("UNKNOWN_KEY", `unknown keyId: ${signer.keyId}`);
    }
    return {
      keyId: signer.keyId,
      backend: signer.backend,
      role: signer.role,
      algorithm: signer.algorithm,
      domain: signer.domain,
      version: record.version,
      publicKey: record.publicKey,
      purpose: record.purpose,
      exportAllowed: false,
      live: isCloudHsmConfigured(),
    };
  }

  throw new KmsSecurityError("INVALID_SIGNER", `unsupported backend: ${signer.backend}`);
}

/**
 * Sign payload via configured backend. Returns signature envelope metadata only.
 * @param {object} signer
 * @param {Record<string, unknown>} payload
 */
export async function signPayload(signer, payload) {
  const domainCheck = validatePayloadDomain(signer, payload);
  if (!domainCheck.ok) {
    throw new KmsSecurityError("DOMAIN_MISMATCH", domainCheck.error);
  }

  const message = domainCheck.message;

  if (signer.backend === BACKEND_MOCK_HSM) {
    return signWithMockHsm(signer, message);
  }

  if (signer.backend === BACKEND_VAULT_TRANSIT) {
    return signWithVaultTransit(signer, message);
  }

  if (signer.backend === BACKEND_CLOUD_HSM) {
    return signWithCloudHsm(signer, message);
  }

  if (signer.backend === BACKEND_LOCAL_OPENSSL) {
    return signWithLocalOpenSsl(signer, message);
  }

  throw new KmsSecurityError("NOT_IMPLEMENTED", `unsupported backend: ${signer.backend}`);
}

/**
 * @param {object} signer
 * @param {Uint8Array} message
 */
function signWithMockHsm(signer, message) {
  const slot = mockHsmSlots.get(signer.keyId);
  if (!slot) {
    throw new KmsSecurityError("UNKNOWN_KEY", `mock slot not found: ${signer.keyId}`);
  }

  const signedAt = new Date().toISOString();

  if (signer.role === SIGNER_ROLE_OPERATOR_CLASSICAL) {
    const sig = crypto.sign("sha256", Buffer.from(message), slot.privateKey);
    return {
      keyId: signer.keyId,
      backend: signer.backend,
      role: signer.role,
      algorithm: CLASSICAL_ALGORITHM,
      curve: CLASSICAL_CURVE,
      domain: signer.domain,
      signature: bytesToHex(sig),
      publicKey: slot.publicKeyHex,
      signedAt,
    };
  }

  const sig = ml_dsa87.sign(message, slot.secretKey);
  return {
    keyId: signer.keyId,
    backend: signer.backend,
    role: signer.role,
    algorithm: PQC_ALGORITHM_VERSION,
    version: PQC_VERSION,
    domain: signer.domain,
    signature: bytesToHex(sig),
    publicKey: slot.publicKeyHex,
    signedAt,
  };
}

/**
 * Resolve Vault backend mode. Live mode never falls back to stub.
 * @returns {"live" | "stub"}
 */
function resolveVaultBackendMode() {
  const wantsLive = isExplicitLiveMode() || isVaultForceLive();
  if (!wantsLive) return "stub";

  if (!isVaultTransitConfigured()) {
    throw new KmsSecurityError(
      "VAULT_NOT_CONFIGURED",
      "live Vault Transit requires VAULT_ADDR and VAULT_TOKEN or OIDC auth (VAULT_JWT_ROLE); stub fallback is forbidden in live mode"
    );
  }
  return "live";
}

/** @returns {boolean} */
function shouldUseVaultLive() {
  return resolveVaultBackendMode() === "live";
}

/**
 * Vault Transit — live API when configured, deterministic stub otherwise.
 * @param {object} signer
 * @param {Uint8Array} message
 */
async function signWithVaultTransit(signer, message) {
  getPublicKeyMetadata(signer);
  const mode = resolveVaultBackendMode();

  if (mode === "live") {
    const keyName = resolveTransitKeyNameForKeyId(signer.keyId);
    const hashAlgorithm = inferVaultHashAlgorithm(signer.algorithm, signer.role);
    try {
      const result = await vaultTransitSign({ keyName, message, hashAlgorithm });
      return {
        keyId: signer.keyId,
        backend: signer.backend,
        role: signer.role,
        algorithm: signer.algorithm,
        domain: signer.domain,
        version: PQC_VERSION,
        signature: result.signature,
        publicKeyId: signer.keyId,
        signedAt: new Date().toISOString(),
        vaultKeyName: result.vaultKeyName,
        live: true,
      };
    } catch (err) {
      throw new KmsSecurityError("VAULT_SIGN_FAILED", err instanceof Error ? err.message : String(err));
    }
  }

  return {
    keyId: signer.keyId,
    backend: signer.backend,
    role: signer.role,
    algorithm: signer.algorithm,
    domain: signer.domain,
    version: PQC_VERSION,
    signature: vaultTransitStubSignature(message),
    publicKeyId: signer.keyId,
    signedAt: new Date().toISOString(),
    stub: true,
  };
}

/** Local OpenSSL 3.5 ML-DSA-87 signer service. */
async function signWithLocalOpenSsl(signer, message) {
  if (!isExplicitLiveMode()) throw new KmsSecurityError("LOCAL_OPENSSL_FORBIDDEN_IN_STUB_MODE", "local-openssl outbound signing is forbidden when KMS_BACKEND_MODE=stub");
  if (!isLocalOpenSslConfigured()) throw new KmsSecurityError("LOCAL_OPENSSL_NOT_CONFIGURED", "LOCAL_OPENSSL_SIGNER_URL is required in live mode");
  getPublicKeyMetadata(signer);
  try {
    const result = await localOpenSslSign({ message, keyId: signer.keyId });
    return { keyId: signer.keyId, backend: signer.backend, role: signer.role, algorithm: signer.algorithm, domain: signer.domain, version: PQC_VERSION, signature: result.signature, publicKeyId: signer.keyId, signedAt: new Date().toISOString(), live: true, encoding: result.encoding };
  } catch (err) {
    throw new KmsSecurityError("LOCAL_OPENSSL_SIGN_FAILED", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Cloud HSM / KMS — live when provider env configured.
 * @param {object} signer
 * @param {Uint8Array} message
 */
async function signWithCloudHsm(signer, message) {
  if (!isExplicitLiveMode()) {
    if (isCloudHsmConfigured()) {
      throw new KmsSecurityError(
        "CLOUD_HSM_FORBIDDEN_IN_STUB_MODE",
        "cloud-hsm outbound signing is forbidden when KMS_BACKEND_MODE=stub"
      );
    }
    throw new KmsSecurityError(
      "NOT_IMPLEMENTED",
      "cloud-hsm signing not configured (set CLOUD_HSM_PROVIDER and credentials)"
    );
  }

  const validation = validateCloudHsmEnv();
  if (!validation.ok) {
    throw new KmsSecurityError(
      "CLOUD_HSM_NOT_CONFIGURED",
      validation.errors.join("; ") || "live cloud-hsm requires provider configuration; stub fallback forbidden"
    );
  }

  try {
    const result = await cloudHsmSign({
      message,
      role: signer.role,
      algorithm: signer.algorithm,
      keyId: signer.keyId,
    });
    const meta = getPublicKeyMetadata(signer);
    return {
      keyId: signer.keyId,
      backend: signer.backend,
      role: signer.role,
      algorithm: signer.algorithm,
      domain: signer.domain,
      version: meta.version,
      signature: result.signature,
      publicKeyId: signer.keyId,
      signedAt: new Date().toISOString(),
      provider: result.provider,
      live: true,
      encoding: result.encoding,
    };
  } catch (err) {
    if (err instanceof CloudHsmError) {
      throw new KmsSecurityError(err.code, err.message);
    }
    throw new KmsSecurityError("CLOUD_HSM_SIGN_FAILED", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Private key export is forbidden by design.
 * @throws {KmsSecurityError}
 */
export function exportPrivateKeyMaterial(_signer) {
  throw new KmsSecurityError("EXPORT_FORBIDDEN", "private key export is forbidden");
}

/**
 * Verify a KMS signature against payload using public metadata only.
 * @param {object} signer
 * @param {Record<string, unknown>} payload
 * @param {object} signatureResult
 */
export async function verifySignedPayload(signer, payload, signatureResult) {
  const domainCheck = validatePayloadDomain(signer, payload);
  if (!domainCheck.ok) {
    return { ok: false, error: domainCheck.error };
  }

  const message = domainCheck.message;
  const meta = getPublicKeyMetadata(signer);

  if (signer.role === SIGNER_ROLE_OPERATOR_CLASSICAL) {
    try {
      const pk = crypto.createPublicKey({
        key: Buffer.from(meta.publicKey, "hex"),
        type: "spki",
        format: "der",
      });
      let signatureHex = signatureResult.signature;
      if (signatureResult.encoding === "base64") {
        signatureHex = bytesToHex(Buffer.from(signatureResult.signature, "base64"));
      }
      return { ok: verifyClassical(message, signatureHex, pk) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (signer.backend === BACKEND_VAULT_TRANSIT && signatureResult.stub) {
    if (isExplicitLiveMode()) {
      return {
        ok: false,
        error: "KMS_STUB_FORBIDDEN_IN_LIVE_MODE: stub KMS verification forbidden in live mode",
      };
    }
    const digest = crypto.createHash("sha256").update(message).digest("hex");
    const expected = `vault-stub-${digest.slice(0, 32)}`;
    return {
      ok: signatureResult.signature === expected,
      error: signatureResult.signature === expected ? undefined : "vault stub signature mismatch",
    };
  }

  if (signer.backend === BACKEND_VAULT_TRANSIT && signatureResult.live) {
    try {
      const keyName = resolveTransitKeyNameForKeyId(signer.keyId);
      const hashAlgorithm = inferVaultHashAlgorithm(signer.algorithm, signer.role);
      const valid = await vaultTransitVerify({
        keyName,
        message,
        signature: signatureResult.signature,
        hashAlgorithm,
      });
      return valid ? { ok: true } : { ok: false, error: "vault transit verify rejected signature" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (signer.backend === BACKEND_LOCAL_OPENSSL && signatureResult.live) {
    const result = await localOpenSslVerify({ message, signature: signatureResult.signature, keyId: signer.keyId });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (signer.backend === BACKEND_CLOUD_HSM && signatureResult.live) {
    const httpVerify = await cloudHsmVerifyHttp(message, signatureResult.signature);
    if (httpVerify.ok || httpVerify.error !== "HTTP verify URL not configured") {
      return httpVerify.ok ? { ok: true } : { ok: false, error: httpVerify.error };
    }
  }

  const envelope = {
    status: "signed",
    algorithmVersion: PQC_ALGORITHM_VERSION,
    version: PQC_VERSION,
    signature: signatureResult.signature,
    publicKey: meta.publicKey,
    publicKeyId: signer.keyId,
    signedAt: signatureResult.signedAt ?? new Date().toISOString(),
  };

  return verifyEnvelope(payload, envelope, meta.publicKey);
}

/** Vault Transit adapter — live when VAULT_ADDR + VAULT_TOKEN configured. */
export const VaultTransitAdapter = {
  backend: BACKEND_VAULT_TRANSIT,
  sign: signWithVaultTransit,
  verify: verifySignedPayload,
  getPublicKeyMetadata,
  isLive: shouldUseVaultLive,
};

/** Cloud HSM adapter — live when CLOUD_HSM_PROVIDER configured. */
export const CloudHsmAdapter = {
  backend: BACKEND_CLOUD_HSM,
  sign: signWithCloudHsm,
  verify: verifySignedPayload,
  getPublicKeyMetadata,
  isConfigured: isCloudHsmConfigured,
};

/** Test helper — clear mock HSM slots between tests. */
export function clearMockHsmSlots() {
  mockHsmSlots.clear();
}

/** Test helper — register ephemeral mock slot without persisting. */
export function registerMockHsmTestKey(keyId, material) {
  if (!keyId.startsWith("test-")) {
    throw new KmsSecurityError("INVALID_KEY_ID", "mock keys must use test- prefix");
  }
  mockHsmSlots.set(keyId, {
    publicKeyHex: material.publicKeyHex.replace(/^0x/, ""),
    secretKey: material.secretKey,
    privateKey: material.privateKey,
    kind: material.kind ?? "mldsa87",
  });
}

export {
  PROVENANCE_DOMAIN,
  AUTH_ENVELOPE_DOMAIN,
  PQC_ALGORITHM,
  CLASSICAL_ALGORITHM,
};
