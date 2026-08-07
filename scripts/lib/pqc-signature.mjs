// ============================================================================
// ML-DSA artifact provenance adapter (Phase 8.13 Task 4)
// Isolated PQC layer — FIPS 204 ML-DSA-87 via @noble/post-quantum.
// Does NOT touch ZK verification path; provenance metadata only.
// ============================================================================
import fs from "fs";
import path from "path";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { fileURLToPath } from "url";
import {
  loadRegistryPublicKey,
  validateEnvelopeKeyReference,
  validateEnvelopeMetadata,
} from "./public-key-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");

export const PROVENANCE_DOMAIN = "AEGIS_ARTIFACT_PROVENANCE_V1";
export const PQC_ALGORITHM = "ML-DSA-87";
export const PQC_ALGORITHM_VERSION = PQC_ALGORITHM;
export const PQC_VERSION = "v1";

export const DEFAULT_PUBLIC_KEYS_DIR = path.join(ROOT, "artifacts", "provenance", "public-keys");
export const DEFAULT_PRIVATE_KEYS_DIR = path.join(ROOT, "artifacts", "provenance", "keys");

/** @param {unknown} obj */
export function sortKeysDeep(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortKeysDeep(obj[key]);
      return acc;
    }, {});
}

/** Stable canonical JSON for signing (sorted keys, no whitespace). */
export function canonicalJson(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

/**
 * Build signing bytes: domain separator + canonical payload.
 * @param {Record<string, unknown>} payload
 */
export function buildSignMessage(payload) {
  const canonical = canonicalJson(payload);
  return new TextEncoder().encode(`${PROVENANCE_DOMAIN}\n${canonical}`);
}

/**
 * Canonical entry payload signed by ML-DSA (excludes envelope fields).
 * @param {object} entry
 */
export function entrySignPayload(entry) {
  return {
    domain: PROVENANCE_DOMAIN,
    artifact: entry.artifact,
    path: entry.path,
    sha256: entry.sha256,
    size: entry.size,
    version: entry.version,
    source: entry.source,
  };
}

export function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

export function hexToBytes(hex) {
  const clean = hex.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("invalid hex encoding");
  }
  return new Uint8Array(Buffer.from(clean, "hex"));
}

/**
 * @returns {{ publicKey: Uint8Array, secretKey: Uint8Array, publicKeyHex: string, secretKeyHex: string }}
 */
export function generateKeypair() {
  const { publicKey, secretKey } = ml_dsa87.keygen();
  return {
    publicKey,
    secretKey,
    publicKeyHex: bytesToHex(publicKey),
    secretKeyHex: bytesToHex(secretKey),
  };
}

/**
 * Create a PQC signature envelope for a canonical payload.
 * @param {Record<string, unknown>} payload
 * @param {{ privateKey?: Uint8Array | string, publicKeyHex?: string, publicKeyId?: string }} [options]
 */
export function createPqcSignatureEnvelope(payload, options = {}) {
  if (!options.privateKey) {
    throw new Error("privateKey required for createPqcSignatureEnvelope");
  }
  const sk = typeof options.privateKey === "string" ? hexToBytes(options.privateKey) : options.privateKey;
  const message = buildSignMessage(payload);
  const signature = ml_dsa87.sign(message, sk);
  return {
    status: "signed",
    algorithmVersion: PQC_ALGORITHM_VERSION,
    version: PQC_VERSION,
    signature: bytesToHex(signature),
    publicKey: options.publicKeyHex ?? null,
    publicKeyId: options.publicKeyId ?? null,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verify a single envelope against payload and embedded/registry public key.
 * @param {Record<string, unknown>} payload
 * @param {object} envelope
 * @param {Uint8Array | string} [publicKeyOverride]
 * @param {{ maxSignatureAgeMs?: number, requireRegistry?: boolean }} [opts]
 */
export function verifyEnvelope(payload, envelope, publicKeyOverride, opts = {}) {
  if (!envelope?.signature) {
    return { ok: false, error: "signature missing" };
  }

  const meta = validateEnvelopeMetadata(envelope, { maxAgeMs: opts.maxSignatureAgeMs });
  if (!meta.ok) {
    return meta;
  }

  const algo = envelope.algorithmVersion ?? envelope.algorithm;
  if (algo && algo !== PQC_ALGORITHM_VERSION) {
    return {
      ok: false,
      error: `algorithm mismatch: expected ${PQC_ALGORITHM_VERSION}, got ${algo}`,
    };
  }
  if (envelope.version && envelope.version !== PQC_VERSION) {
    return {
      ok: false,
      error: `version mismatch: expected ${PQC_VERSION}, got ${envelope.version}`,
    };
  }

  let pkHex = publicKeyOverride;
  if (!pkHex) {
    const keyRef = validateEnvelopeKeyReference(envelope, { requireRegistry: opts.requireRegistry });
    if (!keyRef.ok) {
      return keyRef;
    }
    if (keyRef.record) {
      pkHex = keyRef.record.publicKey;
    } else if (envelope.publicKey) {
      pkHex = envelope.publicKey;
    } else {
      return { ok: false, error: "public key missing from envelope" };
    }
  }

  const pk = typeof pkHex === "string" ? hexToBytes(pkHex) : pkHex;
  const sig = hexToBytes(envelope.signature);
  const message = buildSignMessage(payload);
  const valid = ml_dsa87.verify(sig, message, pk);
  return valid ? { ok: true } : { ok: false, error: "invalid signature" };
}

/**
 * Verify PQC signatures across manifest entries.
 * @param {object} manifest
 * @param {{ required?: boolean, requiredArtifacts?: Set<string>, maxSignatureAgeMs?: number, requireRegistry?: boolean }} [options]
 */
export function verifyPqcSignatureEnvelope(manifest, options = {}) {
  const requiredArtifacts =
    options.requiredArtifacts ??
    new Set([
      "production.zkey",
      "production-vkey.json",
      "aegis_commit_core_v2.wasm",
      "aegis_commit_core_v2.r1cs",
    ]);
  const errors = [];
  const warnings = [];
  let verifiedCount = 0;

  for (const entry of manifest.entries ?? []) {
    const env = entry.pqcSignatureEnvelope;
    const isRequired = options.required && requiredArtifacts.has(entry.artifact);

    if (!env || env.status !== "signed" || !env.signature) {
      if (isRequired) {
        errors.push(`PQC signature required but absent: ${entry.artifact}`);
      } else if (env?.status === "placeholder") {
        warnings.push(`PQC placeholder (legacy): ${entry.artifact}`);
      } else {
        warnings.push(`PQC signature absent: ${entry.artifact}`);
      }
      continue;
    }

    const payload = entrySignPayload(entry);
    const result = verifyEnvelope(payload, env, undefined, {
      maxSignatureAgeMs: options.maxSignatureAgeMs,
      requireRegistry: options.requireRegistry,
    });
    if (!result.ok) {
      errors.push(`PQC verify failed: ${entry.artifact}: ${result.error}`);
    } else {
      verifiedCount++;
    }
  }

  return {
    valid: errors.length === 0,
    algorithm: PQC_ALGORITHM_VERSION,
    verifiedAt: new Date().toISOString(),
    verifiedCount,
    errors,
    warnings,
  };
}

/** @deprecated use createPqcSignatureEnvelope */
export function createPqcSignature(payload, privateKey, opts = {}) {
  const pkHex = opts.publicKeyHex ?? null;
  return createPqcSignatureEnvelope(payload, {
    privateKey,
    publicKeyHex: pkHex,
    publicKeyId: opts.publicKeyId,
  });
}

/** @deprecated use verifyEnvelope */
export function verifyPqcSignature(payload, signatureEnvelope, publicKey) {
  return verifyEnvelope(payload, signatureEnvelope, publicKey);
}

/** Unsigned envelope (no private key at generation time). */
export const PQC_ENVELOPE_UNSIGNED = {
  status: "unsigned",
  algorithmVersion: PQC_ALGORITHM_VERSION,
  version: PQC_VERSION,
  signature: null,
  publicKey: null,
  publicKeyId: null,
  signedAt: null,
};

/** Legacy Phase 8.13 Task 1–3 placeholder. */
export const PQC_ENVELOPE_PLACEHOLDER = {
  status: "placeholder",
  algorithmVersion: PQC_ALGORITHM_VERSION,
  parameterSet: PQC_ALGORITHM_VERSION,
  publicKeyId: null,
  publicKey: null,
  signature: null,
  signedAt: null,
  note: "Phase 8.13 Task 1–3 schema — regenerate for Task 4 signed envelope",
};

/**
 * Load private key from env or gitignored key file.
 * @returns {{ secretKey: Uint8Array, secretKeyHex: string, publicKeyHex: string, publicKeyId: string } | null}
 */
export function loadPrivateKey() {
  const hex = process.env.AEGIS_PQC_PRIVATE_KEY_HEX?.trim();
  if (hex) {
    const pubHex = process.env.AEGIS_PQC_PUBLIC_KEY_HEX?.trim()?.replace(/^0x/, "") ?? null;
    return {
      secretKey: hexToBytes(hex),
      secretKeyHex: hex.replace(/^0x/, ""),
      publicKeyHex: pubHex,
      publicKeyId: process.env.AEGIS_PQC_PUBLIC_KEY_ID?.trim() ?? "ci-injected",
    };
  }

  const keyPath = process.env.AEGIS_PQC_PRIVATE_KEY_PATH?.trim();
  const readKeyFile = (p) => {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return {
      secretKey: hexToBytes(raw.secretKeyHex),
      secretKeyHex: raw.secretKeyHex,
      publicKeyHex: raw.publicKeyHex ?? null,
      publicKeyId: raw.publicKeyId ?? path.basename(p, ".key.json"),
    };
  };

  if (keyPath && fs.existsSync(keyPath)) {
    return readKeyFile(keyPath);
  }

  const defaultKeyPath = path.join(DEFAULT_PRIVATE_KEYS_DIR, "dev-test-1.key.json");
  if (fs.existsSync(defaultKeyPath)) {
    return readKeyFile(defaultKeyPath);
  }

  return null;
}

/**
 * @param {string} keyId
 * @deprecated prefer loadRegistryPublicKey from public-key-registry.mjs
 */
export function loadPublicKeyById(keyId) {
  const record = loadRegistryPublicKey(keyId);
  if (record) {
    return {
      publicKeyId: record.keyId,
      publicKeyHex: record.publicKey,
      algorithm: record.algorithm,
    };
  }

  if (process.env.AEGIS_PQC_PUBLIC_KEY_HEX?.trim()) {
    const envId = process.env.AEGIS_PQC_PUBLIC_KEY_ID?.trim() ?? "ci-injected";
    if (envId === keyId || !keyId) {
      return {
        publicKeyId: envId,
        publicKeyHex: process.env.AEGIS_PQC_PUBLIC_KEY_HEX.trim().replace(/^0x/, ""),
        algorithm: PQC_ALGORITHM_VERSION,
      };
    }
  }

  return null;
}

/**
 * Resolve public key for envelope verification (registry fallback).
 * @param {object} envelope
 */
export function resolvePublicKeyForEnvelope(envelope) {
  if (envelope?.publicKey) {
    return { publicKeyHex: envelope.publicKey, algorithm: envelope.algorithmVersion };
  }
  if (!envelope?.publicKeyId) {
    return null;
  }
  return loadPublicKeyById(envelope.publicKeyId);
}
