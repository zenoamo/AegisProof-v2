// ============================================================================
// Public key registry for PQC provenance (Phase 8.13 Task 5 + lifecycle policy)
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

export const REGISTRY_KEY_STATUSES = Object.freeze({
  ACTIVE: "active",
  DEPRECATED: "deprecated",
  REVOKED: "revoked",
});

/** Normalize registry record to canonical shape. */
export function normalizeRegistryRecord(raw, fallbackId) {
  const keyId = raw.keyId ?? raw.publicKeyId ?? fallbackId;
  const publicKey = (raw.publicKey ?? raw.publicKeyHex ?? "").replace(/^0x/, "");
  const purposes = Array.isArray(raw.purposes)
    ? raw.purposes.filter((value) => typeof value === "string")
    : raw.purpose
      ? [raw.purpose]
      : [];
  return {
    keyId,
    algorithm: raw.algorithm ?? raw.algorithmVersion ?? REGISTRY_ALGORITHM,
    version: raw.version ?? REGISTRY_VERSION,
    publicKey,
    purpose: raw.purpose ?? null,
    purposes,
    createdAt: raw.createdAt ?? null,
    notBefore: raw.notBefore ?? null,
    notAfter: raw.notAfter ?? null,
    revokedAt: raw.revokedAt ?? null,
    status: raw.status ?? REGISTRY_KEY_STATUSES.ACTIVE,
    immutable: raw.immutable !== false,
  };
}

/** Validate lifecycle state and validity window of a registry key. */
export function validateRegistryKeyLifecycle(record, opts = {}) {
  const errors = [];
  const status = record?.status ?? REGISTRY_KEY_STATUSES.ACTIVE;
  const atTimeMs = opts.atTimeMs ?? Date.now();

  if (!Object.values(REGISTRY_KEY_STATUSES).includes(status)) {
    errors.push(`invalid registry key status: ${status}`);
  }
  if (status === REGISTRY_KEY_STATUSES.REVOKED && opts.requireActive !== false) {
    errors.push(`registry key revoked: ${record?.keyId ?? "unknown"}`);
  }
  if (status === REGISTRY_KEY_STATUSES.DEPRECATED && opts.requireActive === true) {
    errors.push(`registry key deprecated: ${record?.keyId ?? "unknown"}`);
  }

  for (const field of ["notBefore", "notAfter", "revokedAt"]) {
    if (record?.[field] == null) continue;
    const parsed = Date.parse(record[field]);
    if (Number.isNaN(parsed)) {
      errors.push(`${field} must be valid ISO-8601`);
    } else if (field === "notBefore" && atTimeMs < parsed) {
      errors.push(`registry key not active before ${record[field]}`);
    } else if (field === "notAfter" && atTimeMs > parsed) {
      errors.push(`registry key expired at ${record[field]}`);
    } else if (field === "revokedAt" && atTimeMs >= parsed && opts.requireActive !== false) {
      errors.push(`registry key revoked at ${record[field]}`);
    }
  }

  if (opts.purpose) {
    const allowed = record?.purposes ?? [];
    if (!allowed.includes(opts.purpose)) {
      errors.push(`registry key purpose mismatch: ${opts.purpose}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** List registered key IDs. */
export function listRegistryKeyIds() {
  if (!fs.existsSync(DEFAULT_PUBLIC_KEYS_DIR)) return [];
  return fs
    .readdirSync(DEFAULT_PUBLIC_KEYS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/** Load a registry public key by key ID. */
export function loadRegistryPublicKey(keyId) {
  if (!keyId) return null;
  const registryPath = path.join(DEFAULT_PUBLIC_KEYS_DIR, `${keyId}.json`);
  if (!fs.existsSync(registryPath)) return null;
  const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const record = normalizeRegistryRecord(raw, keyId);
  return record.publicKey ? record : null;
}

/** Validate envelope key reference against registry when keyId is present. */
export function validateEnvelopeKeyReference(envelope, opts = {}) {
  const expectedAlgorithm = opts.expectedAlgorithm ?? REGISTRY_ALGORITHM;
  const expectedVersion = opts.expectedVersion ?? REGISTRY_VERSION;
  const keyId = envelope?.publicKeyId ?? envelope?.keyId;

  if (!keyId) {
    if (envelope?.publicKey) return { ok: true, source: "embedded" };
    return { ok: false, error: "public key reference missing" };
  }

  const record = loadRegistryPublicKey(keyId);
  if (!record) return { ok: false, error: `unknown publicKeyId: ${keyId}` };

  if (record.algorithm !== expectedAlgorithm) {
    return { ok: false, error: `registry algorithm mismatch: expected ${expectedAlgorithm}, got ${record.algorithm}` };
  }
  if (record.version !== expectedVersion) {
    return { ok: false, error: `registry version mismatch: expected ${expectedVersion}, got ${record.version}` };
  }
  if (envelope.publicKey && envelope.publicKey.replace(/^0x/, "") !== record.publicKey) {
    return { ok: false, error: `embedded publicKey does not match registry: ${keyId}` };
  }
  if (opts.requireRegistry && !record.immutable) {
    return { ok: false, error: `registry key not marked immutable: ${keyId}` };
  }

  return { ok: true, source: "registry", record };
}

/** Validate envelope metadata (signedAt, version). */
export function validateEnvelopeMetadata(envelope, opts = {}) {
  const expectedVersion = opts.expectedVersion ?? REGISTRY_VERSION;
  if (!envelope?.signedAt) return { ok: false, error: "signedAt missing" };

  const signedAtMs = Date.parse(envelope.signedAt);
  if (Number.isNaN(signedAtMs)) return { ok: false, error: "signedAt invalid ISO-8601" };

  const futureSkew = opts.allowFutureSkewMs ?? 60_000;
  if (signedAtMs > Date.now() + futureSkew) return { ok: false, error: "signedAt in future" };
  if (opts.maxAgeMs != null && Date.now() - signedAtMs > opts.maxAgeMs) {
    return { ok: false, error: "signature metadata expired" };
  }
  if (envelope.version && envelope.version !== expectedVersion) {
    return { ok: false, error: `envelope version invalid: ${envelope.version}` };
  }
  return { ok: true, signedAtMs };
}

const FORBIDDEN_REGISTRY_FIELDS = [
  "privateKey",
  "secretKey",
  "secretKeyHex",
  "privateKeyHex",
  "mnemonic",
  "password",
];

/** Validate a registry record before commit (PT-05). */
export function validateRegistryRecord(raw, keyId) {
  const errors = [];
  for (const field of FORBIDDEN_REGISTRY_FIELDS) {
    if (raw?.[field] != null) errors.push(`forbidden field: ${field}`);
  }
  const record = normalizeRegistryRecord(raw, keyId);
  if (!record.publicKey || record.publicKey.length < 64) {
    errors.push("malformed publicKey");
  } else if (!/^[0-9a-fA-F]+$/.test(record.publicKey)) {
    errors.push("publicKey must be hex");
  }
  if (!record.keyId) errors.push("keyId missing");
  if (record.algorithm !== REGISTRY_ALGORITHM) {
    errors.push(`unsupported algorithm: ${record.algorithm}`);
  }
  if (!Object.values(REGISTRY_KEY_STATUSES).includes(record.status)) {
    errors.push(`invalid registry key status: ${record.status}`);
  }
  const lifecycle = validateRegistryKeyLifecycle(record, { requireActive: false });
  errors.push(...lifecycle.errors);
  return { ok: errors.length === 0, errors, record };
}

/** Detect duplicate keyIds across registry directory. */
export function detectDuplicateRegistryKeyIds(dir = DEFAULT_PUBLIC_KEYS_DIR) {
  if (!fs.existsSync(dir)) return { ok: true, duplicates: [], mismatches: [] };
  const seen = new Map();
  const duplicates = [];
  const mismatches = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const keyId = file.replace(/\.json$/, "");
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const record = normalizeRegistryRecord(raw, keyId);
    if (seen.has(record.keyId)) duplicates.push(record.keyId);
    seen.set(record.keyId, file);
    if (record.keyId !== keyId) mismatches.push(`${file} vs ${record.keyId}`);
  }
  return { ok: duplicates.length === 0 && mismatches.length === 0, duplicates, mismatches };
}

/** Write a committable public key registry entry. */
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
    status: params.status ?? REGISTRY_KEY_STATUSES.ACTIVE,
    notBefore: params.notBefore ?? null,
    notAfter: params.notAfter ?? null,
    revokedAt: params.revokedAt ?? null,
    immutable: true,
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), "utf8");
  return outPath;
}
