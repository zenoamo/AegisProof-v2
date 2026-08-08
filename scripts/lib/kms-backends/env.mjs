// Environment configuration and validation for KMS backends.

export const KMS_MODE_STUB = "stub";
export const KMS_MODE_LIVE = "live";

const KEY_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const MOUNT_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

/**
 * @returns {"stub" | "live"}
 */
export function resolveKmsBackendMode() {
  const mode = (process.env.KMS_BACKEND_MODE ?? "").trim().toLowerCase();
  if (mode === KMS_MODE_LIVE) return KMS_MODE_LIVE;
  if (mode === KMS_MODE_STUB) return KMS_MODE_STUB;
  return KMS_MODE_STUB;
}

/** @returns {boolean} */
export function isExplicitLiveMode() {
  return resolveKmsBackendMode() === KMS_MODE_LIVE;
}

/** @returns {boolean} */
export function isVaultForceLive() {
  return process.env.VAULT_TRANSIT_FORCE_LIVE === "1";
}

/**
 * @param {string} keyId
 */
export function validateKeyIdFormat(keyId) {
  if (!keyId || typeof keyId !== "string") {
    return { ok: false, error: "keyId required" };
  }
  if (!KEY_ID_RE.test(keyId)) {
    return { ok: false, error: "keyId contains invalid characters" };
  }
  return { ok: true };
}

/**
 * @param {string} mount
 */
export function validateTransitMount(mount) {
  if (!mount || typeof mount !== "string") {
    return { ok: false, error: "transit mount required" };
  }
  if (!MOUNT_RE.test(mount)) {
    return { ok: false, error: "invalid transit mount name" };
  }
  return { ok: true };
}

/**
 * @param {string} keyName
 */
export function validateTransitKeyName(keyName) {
  if (!keyName || typeof keyName !== "string") {
    return { ok: false, error: "transit key name required" };
  }
  if (keyName.includes("..") || keyName.includes("/") || keyName.includes("\\")) {
    return { ok: false, error: "transit key name must not contain path separators" };
  }
  if (!MOUNT_RE.test(keyName)) {
    return { ok: false, error: "invalid transit key name" };
  }
  return { ok: true };
}

/**
 * @param {string} url
 * @param {string} [label]
 */
export function validateHttpUrl(url, label = "URL") {
  if (!url || typeof url !== "string") {
    return { ok: false, error: `${label} required` };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: `${label} must use http or https` };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: `${label} is not a valid URL` };
  }
}

/**
 * Vault Transit connection settings from environment.
 */
export function readVaultTransitEnv() {
  const addr = (process.env.VAULT_ADDR ?? "").trim().replace(/\/$/, "");
  const token = (process.env.VAULT_TOKEN ?? process.env.VAULT_TRANSIT_TOKEN ?? "").trim();
  const namespace = (process.env.VAULT_NAMESPACE ?? "").trim();
  const mount = (process.env.VAULT_TRANSIT_MOUNT ?? "transit").trim() || "transit";
  const jwtRole = (process.env.VAULT_JWT_ROLE ?? process.env.VAULT_OIDC_ROLE ?? "").trim();
  const hasOidcRequest =
    Boolean(
      (process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "").trim() &&
        (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? "").trim()
    );
  const hasInjectedJwt = Boolean((process.env.VAULT_OIDC_JWT ?? "").trim());
  const hasOidc = Boolean(jwtRole) && (hasOidcRequest || hasInjectedJwt);
  const configured = Boolean(addr && (token || hasOidc));
  return configured
    ? { configured: true, addr, token: token || null, namespace, mount, authMethod: token ? "token" : "oidc" }
    : { configured: false, mount };
}

/**
 * Validate Vault Transit environment for live mode.
 */
export function validateVaultTransitEnv() {
  const env = readVaultTransitEnv();
  const errors = [];

  if (!env.configured) {
    if (!(process.env.VAULT_ADDR ?? "").trim()) errors.push("VAULT_ADDR missing");
    const hasToken = Boolean((process.env.VAULT_TOKEN ?? process.env.VAULT_TRANSIT_TOKEN ?? "").trim());
    const hasOidc = Boolean((process.env.VAULT_JWT_ROLE ?? "").trim()) &&
      (Boolean((process.env.VAULT_OIDC_JWT ?? "").trim()) ||
        Boolean(
          (process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "").trim() &&
            (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? "").trim()
        ));
    if (!hasToken && !hasOidc) {
      errors.push("VAULT_TOKEN or OIDC auth (VAULT_JWT_ROLE + OIDC JWT source) missing");
    }
    return { ok: false, errors, env };
  }

  const addrCheck = validateHttpUrl(env.addr, "VAULT_ADDR");
  if (!addrCheck.ok) errors.push(addrCheck.error);

  const mountCheck = validateTransitMount(env.mount);
  if (!mountCheck.ok) errors.push(mountCheck.error);

  return { ok: errors.length === 0, errors, env };
}

/**
 * Resolve Vault transit key name from signer keyId.
 * @param {string} keyId
 */
export function resolveVaultTransitKeyName(keyId) {
  const prefix = (process.env.VAULT_TRANSIT_KEY_PREFIX ?? "").trim();
  if (prefix) return `${prefix}${keyId}`;
  const mapped = (process.env[`VAULT_TRANSIT_KEY_${keyId.replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase()}`] ?? "").trim();
  if (mapped) return mapped;
  return keyId;
}

/**
 * Cloud HSM provider settings.
 */
export function readCloudHsmEnv() {
  const provider = (process.env.CLOUD_HSM_PROVIDER ?? "").trim().toLowerCase();
  const keyId = (process.env.CLOUD_HSM_KEY_ID ?? process.env.AWS_KMS_KEY_ID ?? "").trim();
  const signingAlgorithm = (process.env.CLOUD_HSM_SIGNING_ALGORITHM ?? process.env.AWS_KMS_SIGNING_ALGORITHM ?? "").trim();
  const signUrl = (process.env.CLOUD_HSM_SIGN_URL ?? "").trim();
  const verifyUrl = (process.env.CLOUD_HSM_VERIFY_URL ?? "").trim();
  const region = (process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "").trim();

  if (provider === "http") {
    const configured = Boolean(signUrl);
    return configured
      ? { configured: true, provider: "http", signUrl, verifyUrl, keyId }
      : { configured: false };
  }

  if (provider === "aws" || provider === "aws-kms") {
    const configured = Boolean(keyId && region);
    return configured
      ? { configured: true, provider: "aws-kms", keyId, signingAlgorithm: signingAlgorithm || "ECDSA_SHA_256", region }
      : { configured: false, provider: "aws-kms" };
  }

  if (provider === "gcp" || provider === "gcp-kms") {
    const gcpKey = (process.env.GCP_KMS_KEY_NAME ?? process.env.CLOUD_HSM_KEY_ID ?? "").trim();
    const configured = Boolean(gcpKey);
    return configured
      ? { configured: true, provider: "gcp-kms", keyId: gcpKey, signingAlgorithm: signingAlgorithm || "ECDSA_SHA_256" }
      : { configured: false, provider: "gcp-kms" };
  }

  if (provider === "azure" || provider === "azure-keyvault") {
    const vaultUrl = (process.env.AZURE_KEY_VAULT_URL ?? "").trim().replace(/\/$/, "");
    const azureKey = (process.env.AZURE_KEY_NAME ?? process.env.CLOUD_HSM_KEY_ID ?? "").trim();
    const configured = Boolean(vaultUrl && azureKey);
    return configured
      ? {
          configured: true,
          provider: "azure-keyvault",
          keyId: azureKey,
          vaultUrl,
          signingAlgorithm: signingAlgorithm || "ES256",
        }
      : { configured: false, provider: "azure-keyvault" };
  }

  if (provider) {
    return { configured: false, provider };
  }

  return { configured: false };
}

/**
 * Validate Cloud HSM environment for live signing.
 */
export function validateCloudHsmEnv() {
  const provider = (process.env.CLOUD_HSM_PROVIDER ?? "").trim().toLowerCase();
  const env = readCloudHsmEnv();
  const errors = [];

  if (!provider) {
    errors.push("CLOUD_HSM_PROVIDER missing");
    return { ok: false, errors, env };
  }

  switch (provider) {
    case "http": {
      const signCheck = validateHttpUrl(env.signUrl, "CLOUD_HSM_SIGN_URL");
      if (!signCheck.ok) errors.push(signCheck.error);
      if (env.verifyUrl) {
        const verifyCheck = validateHttpUrl(env.verifyUrl, "CLOUD_HSM_VERIFY_URL");
        if (!verifyCheck.ok) errors.push(verifyCheck.error);
      }
      break;
    }
    case "aws":
    case "aws-kms": {
      if (!(process.env.AWS_KMS_KEY_ID ?? process.env.CLOUD_HSM_KEY_ID ?? "").trim()) {
        errors.push("AWS_KMS_KEY_ID missing");
      }
      if (!(process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "").trim()) {
        errors.push("AWS_REGION missing");
      }
      break;
    }
    case "gcp":
    case "gcp-kms": {
      if (!(process.env.GCP_KMS_KEY_NAME ?? process.env.CLOUD_HSM_KEY_ID ?? "").trim()) {
        errors.push("GCP_KMS_KEY_NAME missing");
      }
      break;
    }
    case "azure":
    case "azure-keyvault": {
      const vaultCheck = validateHttpUrl(process.env.AZURE_KEY_VAULT_URL ?? "", "AZURE_KEY_VAULT_URL");
      if (!vaultCheck.ok) errors.push(vaultCheck.error);
      if (!(process.env.AZURE_KEY_NAME ?? process.env.CLOUD_HSM_KEY_ID ?? "").trim()) {
        errors.push("AZURE_KEY_NAME missing");
      }
      break;
    }
    default:
      errors.push(`unsupported CLOUD_HSM_PROVIDER: ${provider}`);
  }

  return { ok: errors.length === 0 && env.configured, errors, env };
}

/**
 * Whether native cloud KMS documents ML-DSA-87 support for the provider.
 * Adapter documents ECDSA for AWS/GCP/Azure; ML-DSA-87 provenance uses Vault or HTTP gateway.
 * @param {string} _provider
 */
export function nativeCloudKmsSupportsMldsa(_provider) {
  return false;
}
