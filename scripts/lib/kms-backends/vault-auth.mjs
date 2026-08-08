// GitHub OIDC → Vault JWT auth for KMS signer (Phase 8.14 Task 4).
import { kmsFetch, redactKmsSecrets } from "./http-fetch.mjs";
import { validateHttpUrl } from "./env.mjs";

export class VaultAuthError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status) {
    super(redactKmsSecrets(message));
    this.name = "VaultAuthError";
    this.code = code;
    this.status = status;
  }
}

/** Cached ephemeral token — never logged, never persisted to disk. */
let cachedVaultToken = null;
/** @type {number | null} */
let cachedVaultTokenExpiresAt = null;

/**
 * Read Vault JWT/OIDC auth configuration from environment.
 */
export function readVaultOidcEnv() {
  const addr = (process.env.VAULT_ADDR ?? "").trim().replace(/\/$/, "");
  const role = (process.env.VAULT_JWT_ROLE ?? process.env.VAULT_OIDC_ROLE ?? "").trim();
  const authMount = (process.env.VAULT_JWT_AUTH_MOUNT ?? process.env.VAULT_OIDC_AUTH_MOUNT ?? "jwt").trim() || "jwt";
  const audience = (process.env.VAULT_OIDC_AUDIENCE ?? process.env.ACTIONS_ID_TOKEN_REQUEST_AUDIENCE ?? addr).trim();
  const staticToken = (process.env.VAULT_TOKEN ?? process.env.VAULT_TRANSIT_TOKEN ?? "").trim();
  const injectedJwt = (process.env.VAULT_OIDC_JWT ?? "").trim();

  const oidcRequestUrl = (process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "").trim();
  const oidcRequestToken = (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? "").trim();

  const claimBindings = readOidcClaimBindings();

  const hasOidcRequest = Boolean(oidcRequestUrl && oidcRequestToken);
  const hasInjectedJwt = Boolean(injectedJwt);
  const oidcCapable = Boolean(addr && role && (hasOidcRequest || hasInjectedJwt));

  return {
    addr,
    role,
    authMount,
    audience,
    staticToken,
    injectedJwt,
    oidcRequestUrl,
    oidcRequestToken,
    claimBindings,
    oidcCapable,
    configured: Boolean(addr && (staticToken || oidcCapable)),
  };
}

/**
 * Expected OIDC claim bindings — fail closed when set and mismatch.
 */
export function readOidcClaimBindings() {
  return {
    repository: (process.env.KMS_OIDC_EXPECT_REPOSITORY ?? "").trim(),
    repository_owner: (process.env.KMS_OIDC_EXPECT_OWNER ?? process.env.KMS_OIDC_EXPECT_REPOSITORY_OWNER ?? "").trim(),
    ref: (process.env.KMS_OIDC_EXPECT_REF ?? "").trim(),
    workflow: (process.env.KMS_OIDC_EXPECT_WORKFLOW ?? "").trim(),
    environment: (process.env.KMS_OIDC_EXPECT_ENVIRONMENT ?? "").trim(),
    sub: (process.env.KMS_OIDC_EXPECT_SUBJECT ?? process.env.KMS_OIDC_EXPECT_SUB ?? "").trim(),
  };
}

/**
 * @param {string} pattern
 * @param {string} value
 */
export function matchClaimPattern(pattern, value) {
  if (!pattern) return true;
  if (!value) return false;
  if (pattern === value) return true;
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(value);
  }
  return false;
}

/**
 * Decode JWT payload without signature verification (Vault validates signature).
 * @param {string} jwt
 */
export function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string") {
    throw new VaultAuthError("OIDC_INVALID_JWT", "JWT missing or invalid");
  }
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new VaultAuthError("OIDC_INVALID_JWT", "JWT must have three segments");
  }
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    throw new VaultAuthError("OIDC_INVALID_JWT", "JWT payload is not valid JSON");
  }
}

/**
 * Validate JWT claims against restrictive bindings. Fail closed.
 * @param {Record<string, unknown>} claims
 * @param {ReturnType<typeof readOidcClaimBindings>} bindings
 */
export function validateOidcClaimBindings(claims, bindings = readOidcClaimBindings()) {
  const errors = [];

  const checks = [
    ["repository", bindings.repository, claims.repository],
    ["repository_owner", bindings.repository_owner, claims.repository_owner ?? claims["repository-owner"]],
    ["ref", bindings.ref, claims.ref],
    ["workflow", bindings.workflow, claims.workflow ?? claims.job_workflow_ref?.split("@")[0]?.replace(/^\.github\/workflows\//, "")],
    ["environment", bindings.environment, claims.environment],
    ["sub", bindings.sub, claims.sub],
  ];

  for (const [name, expected, actual] of checks) {
    if (!expected) continue;
    const actualStr = actual == null ? "" : String(actual);
    if (!matchClaimPattern(expected, actualStr)) {
      errors.push(`${name} claim mismatch: expected ${expected}, got ${actualStr || "(missing)"}`);
    }
  }

  if (errors.length > 0) {
    throw new VaultAuthError("OIDC_CLAIM_REJECTED", errors.join("; "));
  }

  return { ok: true, claims };
}

/**
 * Fetch GitHub Actions OIDC JWT (runtime only — never commit).
 */
export async function fetchGitHubOidcJwt() {
  const env = readVaultOidcEnv();

  if (env.injectedJwt) {
    return env.injectedJwt;
  }

  if (!env.oidcRequestUrl || !env.oidcRequestToken) {
    throw new VaultAuthError(
      "OIDC_NOT_CONFIGURED",
      "OIDC JWT unavailable: set ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN or VAULT_OIDC_JWT"
    );
  }

  const url = new URL(env.oidcRequestUrl);
  if (env.audience) {
    url.searchParams.set("audience", env.audience);
  }

  let res;
  try {
    res = await kmsFetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.oidcRequestToken}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new VaultAuthError(
      "OIDC_FETCH_FAILED",
      err instanceof Error ? err.message : String(err)
    );
  }

  if (!res.ok) {
    throw new VaultAuthError("OIDC_FETCH_FAILED", `GitHub OIDC token request failed: HTTP ${res.status}`, res.status);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new VaultAuthError("OIDC_FETCH_FAILED", "GitHub OIDC token response is not JSON");
  }

  const jwt = body?.value;
  if (!jwt || typeof jwt !== "string") {
    throw new VaultAuthError("OIDC_FETCH_FAILED", "GitHub OIDC token response missing value");
  }

  return jwt;
}

/**
 * Validate Vault client token TTL from login response.
 * @param {object} auth
 */
export function validateVaultTokenTtl(auth) {
  if (!auth?.client_token) {
    throw new VaultAuthError("VAULT_AUTH_FAILED", "Vault login response missing client_token");
  }

  const ttl = auth.lease_duration;
  if (typeof ttl === "number" && ttl <= 0) {
    throw new VaultAuthError("VAULT_TOKEN_EXPIRED", "Vault token lease_duration is zero or negative");
  }

  const renewable = auth.renewable;
  const expiresAt =
    typeof ttl === "number" && ttl > 0 ? Date.now() + ttl * 1000 : null;

  return {
    token: auth.client_token,
    leaseDuration: ttl ?? null,
    renewable: Boolean(renewable),
    expiresAt,
  };
}

/**
 * Exchange OIDC JWT for Vault client token via JWT auth method.
 * @param {string} jwt
 */
export async function vaultJwtLogin(jwt) {
  const env = readVaultOidcEnv();
  const addrCheck = validateHttpUrl(env.addr, "VAULT_ADDR");
  if (!addrCheck.ok) {
    throw new VaultAuthError("VAULT_NOT_CONFIGURED", addrCheck.error);
  }
  if (!env.role) {
    throw new VaultAuthError("OIDC_NOT_CONFIGURED", "VAULT_JWT_ROLE missing");
  }

  const url = `${env.addr}/v1/auth/${encodeURIComponent(env.authMount)}/login`;
  const namespace = (process.env.VAULT_NAMESPACE ?? "").trim();
  const headers = { "Content-Type": "application/json" };
  if (namespace) headers["X-Vault-Namespace"] = namespace;

  let res;
  try {
    res = await kmsFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: env.role, jwt }),
    });
  } catch (err) {
    throw new VaultAuthError(
      "VAULT_UNAVAILABLE",
      err instanceof Error ? err.message : String(err)
    );
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  if (res.status === 401 || res.status === 403) {
    throw new VaultAuthError("VAULT_AUTH_FAILED", "Vault JWT login rejected", res.status);
  }
  if (!res.ok) {
    const msg = body?.errors?.[0] ?? body?.error ?? `Vault HTTP ${res.status}`;
    throw new VaultAuthError("VAULT_AUTH_FAILED", String(msg), res.status);
  }

  return validateVaultTokenTtl(body.auth);
}

/**
 * Resolve Vault token: static env token or OIDC → JWT login.
 * Fail closed — no stub fallback in live mode.
 */
export async function resolveVaultAuthToken() {
  const env = readVaultOidcEnv();

  if (env.staticToken) {
    return {
      token: env.staticToken,
      source: "static",
      leaseDuration: null,
      expiresAt: null,
    };
  }

  if (cachedVaultToken && cachedVaultTokenExpiresAt && Date.now() < cachedVaultTokenExpiresAt - 5000) {
    return {
      token: cachedVaultToken,
      source: "oidc-cache",
      leaseDuration: null,
      expiresAt: cachedVaultTokenExpiresAt,
    };
  }

  if (!env.oidcCapable) {
    throw new VaultAuthError(
      "OIDC_NOT_CONFIGURED",
      "Vault auth requires VAULT_TOKEN or OIDC configuration (VAULT_ADDR + VAULT_JWT_ROLE + OIDC JWT source)"
    );
  }

  const jwt = await fetchGitHubOidcJwt();
  validateOidcClaimBindings(decodeJwtPayload(jwt), env.claimBindings);
  const login = await vaultJwtLogin(jwt);

  cachedVaultToken = login.token;
  cachedVaultTokenExpiresAt = login.expiresAt;

  return {
    token: login.token,
    source: "oidc",
    leaseDuration: login.leaseDuration,
    expiresAt: login.expiresAt,
  };
}

/** Test helper — clear cached token between tests. */
export function clearVaultAuthCacheForTests() {
  cachedVaultToken = null;
  cachedVaultTokenExpiresAt = null;
}

/** Whether OIDC or static token auth is configured for live Vault. */
export function isVaultAuthConfigured() {
  return readVaultOidcEnv().configured;
}
