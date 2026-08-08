// HashiCorp Vault Transit backend for KMS signer (Phase 8.14 Task 3).
import crypto from "crypto";
import { kmsFetch, redactKmsSecrets } from "./http-fetch.mjs";
import {
  readVaultTransitEnv,
  resolveVaultTransitKeyName,
  validateVaultTransitEnv,
  validateTransitKeyName,
  validateTransitMount,
} from "./env.mjs";

export class VaultTransitError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status) {
    super(redactKmsSecrets(message));
    this.name = "VaultTransitError";
    this.code = code;
    this.status = status;
  }
}

/** @returns {boolean} */
export function isVaultTransitConfigured() {
  return readVaultTransitEnv().configured;
}

/**
 * @param {string} namespace
 * @param {Record<string, string>} headers
 */
function applyVaultHeaders(namespace, headers) {
  if (namespace) headers["X-Vault-Namespace"] = namespace;
}

/**
 * @param {Response} res
 */
async function parseVaultResponse(res) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  if (res.status === 401 || res.status === 403) {
    throw new VaultTransitError("VAULT_AUTH_FAILED", "Vault authentication or permission denied", res.status);
  }

  if (!res.ok) {
    const msg = body?.errors?.[0] ?? body?.error ?? `Vault HTTP ${res.status}`;
    throw new VaultTransitError("VAULT_HTTP_ERROR", String(msg), res.status);
  }

  return body;
}

/**
 * @param {object} env
 * @param {string} keyName
 * @param {"sign" | "verify"} operation
 */
function buildTransitUrl(env, keyName, operation) {
  const mountCheck = validateTransitMount(env.mount);
  if (!mountCheck.ok) {
    throw new VaultTransitError("VAULT_INVALID_MOUNT", mountCheck.error);
  }
  const keyCheck = validateTransitKeyName(keyName);
  if (!keyCheck.ok) {
    throw new VaultTransitError("VAULT_INVALID_KEY", keyCheck.error);
  }
  return `${env.addr}/v1/${env.mount}/${operation}/${encodeURIComponent(keyName)}`;
}

/**
 * Assert Vault is ready for live operations.
 */
export function assertVaultTransitLiveReady() {
  const validation = validateVaultTransitEnv();
  if (!validation.ok) {
    throw new VaultTransitError(
      "VAULT_NOT_CONFIGURED",
      validation.errors.join("; ") || "Vault Transit not configured"
    );
  }
  return validation.env;
}

/**
 * @param {object} opts
 * @param {string} opts.keyName
 * @param {Uint8Array} opts.message
 * @param {string} [opts.hashAlgorithm]
 */
export async function vaultTransitSign(opts) {
  const env = assertVaultTransitLiveReady();
  const url = buildTransitUrl(env, opts.keyName, "sign");
  const headers = {
    "X-Vault-Token": env.token,
    "Content-Type": "application/json",
  };
  applyVaultHeaders(env.namespace ?? "", headers);

  const payload = {
    input: Buffer.from(opts.message).toString("base64"),
  };
  if (opts.hashAlgorithm) {
    payload.hash_algorithm = opts.hashAlgorithm;
  }

  let res;
  try {
    res = await kmsFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "KmsFetchTimeoutError") {
      throw new VaultTransitError("VAULT_TIMEOUT", err.message);
    }
    throw new VaultTransitError("VAULT_UNAVAILABLE", err instanceof Error ? err.message : String(err));
  }

  const body = await parseVaultResponse(res);
  const signature = body?.data?.signature;
  if (!signature || typeof signature !== "string") {
    throw new VaultTransitError("VAULT_BAD_RESPONSE", "Vault transit/sign response missing data.signature");
  }
  return {
    signature,
    keyVersion: body?.data?.key_version,
    vaultKeyName: opts.keyName,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.keyName
 * @param {Uint8Array} opts.message
 * @param {string} opts.signature
 * @param {string} [opts.hashAlgorithm]
 */
export async function vaultTransitVerify(opts) {
  const env = assertVaultTransitLiveReady();
  const url = buildTransitUrl(env, opts.keyName, "verify");
  const headers = {
    "X-Vault-Token": env.token,
    "Content-Type": "application/json",
  };
  applyVaultHeaders(env.namespace ?? "", headers);

  const payload = {
    input: Buffer.from(opts.message).toString("base64"),
    signature: opts.signature,
  };
  if (opts.hashAlgorithm) {
    payload.hash_algorithm = opts.hashAlgorithm;
  }

  let res;
  try {
    res = await kmsFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "KmsFetchTimeoutError") {
      throw new VaultTransitError("VAULT_TIMEOUT", err.message);
    }
    throw new VaultTransitError("VAULT_UNAVAILABLE", err instanceof Error ? err.message : String(err));
  }

  const body = await parseVaultResponse(res);
  if (typeof body?.data?.valid !== "boolean") {
    throw new VaultTransitError("VAULT_BAD_RESPONSE", "Vault transit/verify response missing data.valid");
  }
  return body.data.valid;
}

/** @param {string} keyId */
export function resolveTransitKeyNameForKeyId(keyId) {
  return resolveVaultTransitKeyName(keyId);
}

/**
 * @param {string} algorithm
 * @param {string} role
 */
export function inferVaultHashAlgorithm(algorithm, role) {
  const override = (process.env.VAULT_TRANSIT_HASH_ALGORITHM ?? "").trim();
  if (override) return override;
  if (role === "operator-classical" || algorithm === "ECDSA-secp256k1") {
    return "sha2-256";
  }
  return "sha2-256";
}

/**
 * Deterministic stub signature for stub/test mode only.
 * @param {Uint8Array} message
 */
export function vaultTransitStubSignature(message) {
  const digest = crypto.createHash("sha256").update(message).digest("hex");
  return `vault-stub-${digest.slice(0, 32)}`;
}

export { validateVaultTransitEnv };
