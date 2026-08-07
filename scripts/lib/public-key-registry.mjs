// ============================================================================
// Public key registry for PQC provenance (Phase 8.13 Task 5)
// Committed public keys only — private keys never stored in repository.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_ROOT = path.resolve(__dirname, "..", "..");
export const DEFAULT_PUBLIC_KEYS_DIR = path.join(REGISTRY_ROOT, "artifacts", "provenance", "public-keys");
export const REGISTRY_ALGORITHM = "ML-DSA-87";
export const REGISTRY_VERSION = "v1";

/**
 * Normalize registry record to canonical shape.
 * @param {object} raw
 * @param {string} [fallbackId]
 */
export function normalizeRegistryRecord(raw, fallbackId) {
  const keyId = raw.keyId ?? raw.publicKeyId ?? fallbackId;
  const publicKey = (raw.publicKey ?? raw.publicKeyHex ?? "").replace(/^0x/, "");
  return {
    keyId,
    algorithm: raw.algorithm ?? raw.algorithmVersion ?? REGISTRY_ALGORITHM,
    version: raw.version ?? REGISTRY_VERSION,
    publicKey,
    purpose: raw.purpose ?? null,
    createdAt: raw.createdAt ?? null,
    immutable: raw.immutable !== false,
  };
}

/**
 * @returns {string[]}
 */
export function listRegistryKeyIds() {
  if (!fs.existsSync(DEFAULT_PUBLIC_KEYS_DIR)) return [];
  return fs
    .readdirSync(DEFAULT_PUBLIC_KEYS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/**
 * @param {string} keyId
 */
export function loadRegistryPublicKey(keyId) {
  if (!keyId) return null;

  const registryPath = path.join(DEFAULT_PUBLIC_KEYS_DIR, `${keyId}.json`);
  if (!fs.existsSync(registryPath)) {
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const record = normalizeRegistryRecord(raw, keyId);

  if (!record.publicKey) {
    return null;
  }

  return record;
}

/**
 * Validate envelope key reference against registry when keyId is present.
 * @param {object} envelope
 * @param {{ requireRegistry?: boolean, expectedAlgorithm?: string, expectedVersion?: string }} [opts]
 */
export function validateEnvelopeKeyReference(envelope, opts = {}) {
  const expectedAlgorithm = opts.expectedAlgorithm ?? REGISTRY_ALGORITHM;
  const expectedVersion = opts.expectedVersion ?? REGISTRY_VERSION;
  const keyId = envelope?.publicKeyId ?? envelope?.keyId;

  if (!keyId) {
    if (envelope?.publicKey) {
      return { ok: true, source: "embedded" };
    }
    return { ok: false, error: "public key reference missing" };
  }

  const record = loadRegistryPublicKey(keyId);
  if (!record) {
    return { ok: false, error: `unknown publicKeyId: ${keyId}` };
  }

  if (record.algorithm !== expectedAlgorithm) {
    return {
      ok: false,
      error: `registry algorithm mismatch: expected ${expectedAlgorithm}, got ${record.algorithm}`,
    };
  }

  if (record.version !== expectedVersion) {
    return {
      ok: false,
      error: `registry version mismatch: expected ${expectedVersion}, got ${record.version}`,
    };
  }

  if (envelope.publicKey && envelope.publicKey.replace(/^0x/, "") !== record.publicKey) {
    return { ok: false, error: `embedded publicKey does not match registry: ${keyId}` };
  }

  if (opts.requireRegistry && !record.immutable) {
    return { ok: false, error: `registry key not marked immutable: ${keyId}` };
  }

  return { ok: true, source: "registry", record };
}

/**
 * Validate envelope metadata (signedAt, version).
 * @param {object} envelope
 * @param {{ maxAgeMs?: number, allowFutureSkewMs?: number, expectedVersion?: string }} [opts]
 */
export function validateEnvelopeMetadata(envelope, opts = {}) {
  const expectedVersion = opts.expectedVersion ?? REGISTRY_VERSION;

  if (!envelope?.signedAt) {
    return { ok: false, error: "signedAt missing" };
  }

  const signedAtMs = Date.parse(envelope.signedAt);
  if (Number.isNaN(signedAtMs)) {
    return { ok: false, error: "signedAt invalid ISO-8601" };
  }

  const futureSkew = opts.allowFutureSkewMs ?? 60_000;
  if (signedAtMs > Date.now() + futureSkew) {
    return { ok: false, error: "signedAt in future" };
  }

  if (opts.maxAgeMs != null && Date.now() - signedAtMs > opts.maxAgeMs) {
    return { ok: false, error: "signature metadata expired" };
  }

  if (envelope.version && envelope.version !== expectedVersion) {
    return { ok: false, error: `envelope version invalid: ${envelope.version}` };
  }

  return { ok: true, signedAtMs };
}

/**
 * Write a committable public key registry entry.
 * @param {{ keyId: string, publicKeyHex: string, purpose?: string }} params
 */
export function writeRegistryPublicKey(params) {
  const outPath = path.join(DEFAULT_PUBLIC_KEYS_DIR, `${params.keyId}.json`);
  fs.mkdirSync(DEFAULT_PUBLIC_KEYS_DIR, { recursive: true });
  const record = {
    keyId: params.keyId,
    algorithm: REGISTRY_ALGORITHM,
    version: REGISTRY_VERSION,
    publicKey: params.publicKeyHex.replace(/^0x/, ""),
    purpose: params.purpose ?? "CI verification registry",
    createdAt: new Date().toISOString(),
    immutable: true,
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), "utf8");
  return outPath;
}
