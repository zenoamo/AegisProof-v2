// Cloud HSM / KMS backend for KMS signer (Phase 8.14 Task 3).
import crypto from "crypto";
import { kmsFetch, redactKmsSecrets } from "./http-fetch.mjs";
import {
  readCloudHsmEnv,
  validateCloudHsmEnv,
  nativeCloudKmsSupportsMldsa,
} from "./env.mjs";

export class CloudHsmError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(redactKmsSecrets(message));
    this.name = "CloudHsmError";
    this.code = code;
  }
}

/** @returns {boolean} */
export function isCloudHsmConfigured() {
  return readCloudHsmEnv().configured;
}

/**
 * Assert cloud HSM is ready for live operations.
 */
export function assertCloudHsmLiveReady() {
  const validation = validateCloudHsmEnv();
  if (!validation.ok) {
    throw new CloudHsmError(
      "CLOUD_HSM_NOT_CONFIGURED",
      validation.errors.join("; ") || "Cloud HSM not configured"
    );
  }
  return validation.env;
}

/**
 * @param {string} role
 * @param {string} algorithm
 * @param {{ provider?: string }} env
 */
export function assertCloudHsmRoleSupported(role, algorithm, env) {
  if (env.provider === "http") return;

  if (role === "operator-classical" || algorithm === "ECDSA-secp256k1") {
    return;
  }

  if ((role === "provenance" || role === "operator-pqc") && nativeCloudKmsSupportsMldsa(env.provider)) {
    return;
  }

  if (role === "provenance" || role === "operator-pqc") {
    throw new CloudHsmError(
      "UNSUPPORTED_ALGORITHM",
      `${env.provider} native API does not document ML-DSA-87 for role ${role}; use vault-transit or http HSM gateway`
    );
  }

  throw new CloudHsmError("UNSUPPORTED_ROLE", `unsupported role ${role} for provider ${env.provider}`);
}

/**
 * @param {object} opts
 * @param {Uint8Array} opts.message
 * @param {string} opts.role
 * @param {string} opts.algorithm
 * @param {string} opts.keyId
 */
export async function cloudHsmSign(opts) {
  const env = assertCloudHsmLiveReady();
  assertCloudHsmRoleSupported(opts.role, opts.algorithm, env);

  switch (env.provider) {
    case "http":
      return signViaHttpGateway(opts.message, env);
    case "aws-kms":
      return signViaAwsKms(opts.message, env);
    case "gcp-kms":
      return signViaGcpKms(opts.message, env);
    case "azure-keyvault":
      return signViaAzureKeyVault(opts.message, env);
    default:
      throw new CloudHsmError("UNSUPPORTED_PROVIDER", `unsupported cloud HSM provider: ${env.provider}`);
  }
}

/**
 * @param {Uint8Array} message
 * @param {{ signUrl: string, keyId?: string }} env
 */
async function signViaHttpGateway(message, env) {
  let res;
  try {
    res = await kmsFetch(env.signUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CLOUD_HSM_AUTH_HEADER
          ? { Authorization: process.env.CLOUD_HSM_AUTH_HEADER }
          : {}),
      },
      body: JSON.stringify({
        keyId: env.keyId,
        digest: crypto.createHash("sha256").update(message).digest("base64"),
        message: Buffer.from(message).toString("base64"),
        algorithm: process.env.CLOUD_HSM_ALGORITHM ?? "ML-DSA-87",
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "KmsFetchTimeoutError") {
      throw new CloudHsmError("HTTP_HSM_TIMEOUT", err.message);
    }
    throw new CloudHsmError("HTTP_HSM_UNAVAILABLE", err instanceof Error ? err.message : String(err));
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new CloudHsmError("HTTP_HSM_ERROR", body?.error ?? body?.message ?? `HTTP ${res.status}`);
  }

  const signature = body.signature ?? body.data?.signature;
  if (!signature || typeof signature !== "string") {
    throw new CloudHsmError("HTTP_HSM_BAD_RESPONSE", "HSM gateway response missing signature");
  }

  return {
    signature: signature.replace(/^0x/, ""),
    provider: "http",
    keyId: env.keyId,
  };
}

/**
 * @param {Uint8Array} message
 * @param {{ keyId: string, signingAlgorithm?: string, region?: string }} env
 */
async function signViaAwsKms(message, env) {
  let KMSClient;
  let SignCommand;
  try {
    ({ KMSClient, SignCommand } = await import("@aws-sdk/client-kms"));
  } catch {
    throw new CloudHsmError(
      "AWS_SDK_MISSING",
      "Install @aws-sdk/client-kms for aws-kms provider (optional dependency)"
    );
  }

  const client = new KMSClient({ region: env.region });
  const algorithm = env.signingAlgorithm ?? "ECDSA_SHA_256";
  const cmd = new SignCommand({
    KeyId: env.keyId,
    Message: Buffer.from(message),
    MessageType: "RAW",
    SigningAlgorithm: algorithm,
  });

  let out;
  try {
    out = await client.send(cmd);
  } catch (err) {
    throw new CloudHsmError("AWS_KMS_SIGN_FAILED", err instanceof Error ? err.message : String(err));
  }

  if (!out.Signature) {
    throw new CloudHsmError("AWS_KMS_BAD_RESPONSE", "KMS Sign returned empty Signature");
  }

  return {
    signature: Buffer.from(out.Signature).toString("base64"),
    provider: "aws-kms",
    keyId: env.keyId,
    signingAlgorithm: algorithm,
    encoding: "base64",
  };
}

/**
 * @param {Uint8Array} message
 * @param {{ keyId: string }} env
 */
async function signViaGcpKms(message, env) {
  let GoogleAuth;
  try {
    ({ GoogleAuth } = await import("google-auth-library"));
  } catch {
    throw new CloudHsmError(
      "GCP_AUTH_MISSING",
      "Install google-auth-library for gcp-kms provider (optional dependency)"
    );
  }

  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const digest = crypto.createHash("sha256").update(message).digest("base64");
  const url = `https://cloudkms.googleapis.com/v1/${env.keyId}:asymmetricSign`;

  let res;
  try {
    res = await client.request({
      url,
      method: "POST",
      data: { digest: { sha256: digest } },
      timeout: Number(process.env.KMS_HTTP_TIMEOUT_MS ?? 15000),
    });
  } catch (err) {
    throw new CloudHsmError("GCP_KMS_SIGN_FAILED", err instanceof Error ? err.message : String(err));
  }

  const signature = res?.data?.signature;
  if (!signature || typeof signature !== "string") {
    throw new CloudHsmError("GCP_KMS_BAD_RESPONSE", "GCP asymmetricSign missing signature");
  }

  return {
    signature,
    provider: "gcp-kms",
    keyId: env.keyId,
    encoding: "base64",
  };
}

/**
 * @param {Uint8Array} message
 * @param {{ vaultUrl: string, keyId: string, signingAlgorithm?: string }} env
 */
async function signViaAzureKeyVault(message, env) {
  let DefaultAzureCredential;
  try {
    ({ DefaultAzureCredential } = await import("@azure/identity"));
  } catch {
    throw new CloudHsmError(
      "AZURE_IDENTITY_MISSING",
      "Install @azure/identity for azure-keyvault provider (optional dependency)"
    );
  }

  const credential = new DefaultAzureCredential();
  const token = await credential.getToken("https://vault.azure.net/.default");
  const digest = crypto.createHash("sha256").update(message).digest("base64");
  const apiVersion = process.env.AZURE_KEYVAULT_API_VERSION ?? "7.4";
  const url = `${env.vaultUrl}/keys/${encodeURIComponent(env.keyId)}/sign?api-version=${apiVersion}`;

  let res;
  try {
    res = await kmsFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        alg: env.signingAlgorithm ?? "ES256",
        value: digest,
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "KmsFetchTimeoutError") {
      throw new CloudHsmError("AZURE_KV_TIMEOUT", err.message);
    }
    throw new CloudHsmError("AZURE_KV_UNAVAILABLE", err instanceof Error ? err.message : String(err));
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new CloudHsmError("AZURE_KV_SIGN_FAILED", body?.error?.message ?? `HTTP ${res.status}`);
  }

  const signature = body?.value;
  if (!signature || typeof signature !== "string") {
    throw new CloudHsmError("AZURE_KV_BAD_RESPONSE", "Azure Key Vault sign missing value");
  }

  return {
    signature,
    provider: "azure-keyvault",
    keyId: env.keyId,
    encoding: "base64",
  };
}

/**
 * @param {Uint8Array} message
 * @param {string} signature
 */
export async function cloudHsmVerifyHttp(message, signature) {
  const env = readCloudHsmEnv();
  if (!env.configured || env.provider !== "http" || !env.verifyUrl) {
    return { ok: false, error: "HTTP verify URL not configured" };
  }

  let res;
  try {
    res = await kmsFetch(env.verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CLOUD_HSM_AUTH_HEADER
          ? { Authorization: process.env.CLOUD_HSM_AUTH_HEADER }
          : {}),
      },
      body: JSON.stringify({
        keyId: env.keyId,
        digest: crypto.createHash("sha256").update(message).digest("base64"),
        signature,
        message: Buffer.from(message).toString("base64"),
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "KmsFetchTimeoutError") {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
  }
  return { ok: Boolean(body.valid ?? body.ok) };
}

export { validateCloudHsmEnv, nativeCloudKmsSupportsMldsa };
