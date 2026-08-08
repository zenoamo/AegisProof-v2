// Testable fetch wrapper for KMS backend HTTP clients (timeout + test override).

/** @type {typeof fetch | null} */
let fetchOverride = null;

/** @type {number | null} */
let timeoutOverrideMs = null;

/** @param {typeof fetch} fn */
export function setKmsFetchForTests(fn) {
  fetchOverride = fn;
}

export function resetKmsFetchForTests() {
  fetchOverride = null;
  timeoutOverrideMs = null;
}

/** @param {number} ms */
export function setKmsFetchTimeoutForTests(ms) {
  timeoutOverrideMs = ms;
}

/**
 * @returns {number}
 */
export function resolveKmsFetchTimeoutMs() {
  if (timeoutOverrideMs != null) return timeoutOverrideMs;
  const raw = (process.env.KMS_HTTP_TIMEOUT_MS ?? "15000").trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

/**
 * @param {string | URL | Request} input
 * @param {RequestInit} [init]
 */
export async function kmsFetch(input, init = {}) {
  const impl = fetchOverride ?? globalThis.fetch;
  if (!impl) {
    throw new Error("fetch is not available in this runtime");
  }

  const timeoutMs = resolveKmsFetchTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchPromise = impl(input, {
    ...init,
    signal: init.signal ?? controller.signal,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutErr = new Error(`KMS HTTP timeout after ${timeoutMs}ms`);
      timeoutErr.name = "KmsFetchTimeoutError";
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    if (err instanceof Error && (err.name === "KmsFetchTimeoutError" || err.name === "AbortError")) {
      const timeoutErr = new Error(`KMS HTTP timeout after ${timeoutMs}ms`);
      timeoutErr.name = "KmsFetchTimeoutError";
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Redact sensitive substrings from error messages before surfacing.
 * @param {string} message
 */
export function redactKmsSecrets(message) {
  if (!message) return message;
  let out = String(message);
  const token = (process.env.VAULT_TOKEN ?? process.env.VAULT_TRANSIT_TOKEN ?? "").trim();
  if (token.length >= 8) {
    out = out.split(token).join("[REDACTED_VAULT_TOKEN]");
  }
  const authHeader = (process.env.CLOUD_HSM_AUTH_HEADER ?? "").trim();
  if (authHeader.length >= 8) {
    out = out.split(authHeader).join("[REDACTED_AUTH_HEADER]");
  }
  return out.replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [REDACTED]");
}
