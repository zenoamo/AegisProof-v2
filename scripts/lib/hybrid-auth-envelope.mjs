// ============================================================================
// Hybrid authentication envelope (Phase 8.13 Task 6 — research layer)
// ----------------------------------------------------------------------------
// Classical ECDSA + ML-DSA-87 PQC — scripts/ only, no protocol/SDK/contract changes.
// Verification order: payload → domain → classical → PQC
// ============================================================================
import crypto from "crypto";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import {
  canonicalJson,
  sortKeysDeep,
  bytesToHex,
  hexToBytes,
  generateKeypair as generatePqcKeypair,
} from "./pqc-signature.mjs";
import {
  loadRegistryPublicKey,
  validateEnvelopeKeyReference,
  REGISTRY_ALGORITHM,
  REGISTRY_VERSION,
} from "./public-key-registry.mjs";

export const AUTH_ENVELOPE_DOMAIN = "AEGIS_AUTH_ENVELOPE_V1";
export const HYBRID_AUTH_VERSION = "v1";
export const HYBRID_SCHEMA_VERSION = 1;
export const CLASSICAL_ALGORITHM = "ECDSA";
export const CLASSICAL_CURVE = "secp256k1";
export const PQC_ALGORITHM = REGISTRY_ALGORITHM;
export const PQC_VERSION = REGISTRY_VERSION;

/** @deprecated use HYBRID_AUTH_VERSION */
export const HYBRID_SCHEMA_VERSION_LEGACY = HYBRID_SCHEMA_VERSION;

/**
 * Build canonical signing bytes for auth payloads.
 * @param {Record<string, unknown>} payload
 */
export function buildAuthSignMessage(payload) {
  const canonical = canonicalJson(sortKeysDeep(payload));
  return new TextEncoder().encode(`${AUTH_ENVELOPE_DOMAIN}\n${canonical}`);
}

/**
 * Validate payload structure before signature verification.
 * @param {unknown} payload
 */
export function validateAuthPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be object" };
  }
  const p = payload;
  if (!p.domain || typeof p.domain !== "string") {
    return { ok: false, error: "payload.domain missing" };
  }
  if (p.domain !== "AEGIS_DEPLOYMENT_AUTH_V1") {
    return { ok: false, error: `payload.domain mismatch: ${p.domain}` };
  }
  if (!p.operator) {
    return { ok: false, error: "payload.operator missing" };
  }
  if (!p.action) {
    return { ok: false, error: "payload.action missing" };
  }
  return { ok: true };
}

/**
 * @returns {{ privateKey: crypto.KeyObject, publicKey: crypto.KeyObject, publicKeyHex: string }}
 */
export function generateClassicalKeypair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: CLASSICAL_CURVE,
  });
  const publicKeyHex = bytesToHex(publicKey.export({ type: "spki", format: "der" }));
  return { privateKey, publicKey, publicKeyHex };
}

/**
 * Sign auth message with ECDSA secp256k1 (SHA-256 digest).
 * @param {Uint8Array} message
 * @param {crypto.KeyObject | string} privateKey
 */
export function signClassical(message, privateKey) {
  const sig = crypto.sign("sha256", Buffer.from(message), privateKey);
  return bytesToHex(sig);
}

/**
 * Verify ECDSA classical signature.
 * @param {Uint8Array} message
 * @param {string} signatureHex
 * @param {crypto.KeyObject | string} publicKey
 */
export function verifyClassical(message, signatureHex, publicKey) {
  try {
    return crypto.verify("sha256", Buffer.from(message), publicKey, hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

/**
 * Sign auth message with ML-DSA-87.
 * @param {Uint8Array} message
 * @param {Uint8Array | string} secretKey
 */
export function signPqcAuth(message, secretKey) {
  const sk = typeof secretKey === "string" ? hexToBytes(secretKey) : secretKey;
  return bytesToHex(ml_dsa87.sign(message, sk));
}

/**
 * Verify ML-DSA-87 auth signature.
 * @param {Uint8Array} message
 * @param {string} signatureHex
 * @param {Uint8Array | string} publicKey
 */
export function verifyPqcAuth(message, signatureHex, publicKey) {
  try {
    const pk = typeof publicKey === "string" ? hexToBytes(publicKey) : publicKey;
    return ml_dsa87.verify(hexToBytes(signatureHex), message, pk);
  } catch {
    return false;
  }
}

/**
 * Create hybrid auth envelope.
 * @param {Record<string, unknown>} payload
 * @param {{
 *   classicalPrivateKey?: crypto.KeyObject,
 *   pqcPrivateKey?: Uint8Array | string,
 *   pqcPublicKeyHex?: string,
 *   pqcPublicKeyId?: string,
 *   classicalSignature?: string,
 *   pqcSignature?: string,
 * }} [options]
 */
export function createHybridAuthEnvelope(payload, options = {}) {
  const payloadCheck = validateAuthPayload(payload);
  if (!payloadCheck.ok) {
    throw new Error(payloadCheck.error);
  }

  const message = buildAuthSignMessage(payload);
  const envelope = {
    domain: AUTH_ENVELOPE_DOMAIN,
    version: HYBRID_AUTH_VERSION,
    payload: sortKeysDeep(payload),
    classicalSignature: null,
    pqcSignature: null,
    createdAt: new Date().toISOString(),
  };

  if (options.classicalPrivateKey || options.classicalSignature) {
    const sig =
      options.classicalSignature ??
      signClassical(message, options.classicalPrivateKey);
    envelope.classicalSignature = {
      algorithm: CLASSICAL_ALGORITHM,
      curve: CLASSICAL_CURVE,
      signature: sig,
    };
  }

  if (options.pqcPrivateKey || options.pqcSignature) {
    const publicKeyHex =
      options.pqcPublicKeyHex ??
      (options.pqcPrivateKey
        ? bytesToHex(ml_dsa87.getPublicKey(
            typeof options.pqcPrivateKey === "string"
              ? hexToBytes(options.pqcPrivateKey)
              : options.pqcPrivateKey
          ))
        : null);
    const sig =
      options.pqcSignature ?? signPqcAuth(message, options.pqcPrivateKey);
    envelope.pqcSignature = {
      algorithm: PQC_ALGORITHM,
      version: PQC_VERSION,
      signature: sig,
      publicKey: publicKeyHex,
      publicKeyId: options.pqcPublicKeyId ?? null,
    };
  }

  return envelope;
}

/**
 * Verify hybrid auth envelope.
 * Order: canonical payload → domain → classical → PQC
 * @param {object} envelope
 * @param {{
 *   requireClassical?: boolean,
 *   requirePqc?: boolean,
 *   classicalPublicKey?: crypto.KeyObject | string,
 *   verifyClassical?: (payload: unknown, sig: string, message: Uint8Array) => boolean,
 *   maxSignatureAgeMs?: number,
 * }} [opts]
 */
export function verifyHybridAuthEnvelope(envelope, opts = {}) {
  const errors = [];
  const warnings = [];

  // 1. Domain separation
  if (envelope.domain !== AUTH_ENVELOPE_DOMAIN) {
    errors.push(`domain mismatch: expected ${AUTH_ENVELOPE_DOMAIN}, got ${envelope.domain}`);
  }
  if (envelope.version !== HYBRID_AUTH_VERSION) {
    errors.push(`version mismatch: expected ${HYBRID_AUTH_VERSION}, got ${envelope.version}`);
  }

  // 2. Canonical payload validation
  const payloadCheck = validateAuthPayload(envelope.payload);
  if (!payloadCheck.ok) {
    errors.push(`payload invalid: ${payloadCheck.error}`);
  }

  const message = buildAuthSignMessage(envelope.payload ?? {});

  const hasClassical = Boolean(envelope.classicalSignature?.signature);
  const hasPqc = Boolean(envelope.pqcSignature?.signature);

  if (opts.requireClassical && !hasClassical) {
    errors.push("classical signature required but absent");
  }
  if (opts.requirePqc && !hasPqc) {
    errors.push("PQC signature required but absent");
  }
  if (!hasClassical && !hasPqc) {
    warnings.push("no signatures present (research mode)");
  }

  // 3. Classical signature verification
  if (hasClassical) {
    const cs = envelope.classicalSignature;
    if (cs.algorithm !== CLASSICAL_ALGORITHM) {
      errors.push(`classical algorithm downgrade: ${cs.algorithm}`);
    } else if (opts.verifyClassical) {
      if (!opts.verifyClassical(envelope.payload, cs.signature, message)) {
        errors.push("classical signature verification failed");
      }
    } else if (opts.classicalPublicKey) {
      if (!verifyClassical(message, cs.signature, opts.classicalPublicKey)) {
        errors.push("classical signature verification failed");
      }
    } else {
      warnings.push("classical signature present but no verifier configured");
    }
  } else {
    warnings.push("classical signature absent (compatibility mode)");
  }

  // 4. PQC signature verification
  if (hasPqc) {
    const ps = envelope.pqcSignature;
    if (ps.algorithm !== PQC_ALGORITHM) {
      errors.push(`PQC algorithm downgrade: ${ps.algorithm}`);
    }
    if (ps.version && ps.version !== PQC_VERSION) {
      errors.push(`PQC version mismatch: ${ps.version}`);
    }

    const keyRef = validateEnvelopeKeyReference(
      { publicKeyId: ps.publicKeyId, publicKey: ps.publicKey, algorithmVersion: ps.algorithm },
      { expectedAlgorithm: PQC_ALGORITHM, expectedVersion: PQC_VERSION }
    );
    if (ps.publicKeyId && !keyRef.ok) {
      errors.push(`PQC key reference: ${keyRef.error}`);
    }

    let pkHex = ps.publicKey;
    if (!pkHex && keyRef.record) {
      pkHex = keyRef.record.publicKey;
    }
    if (!pkHex) {
      errors.push("PQC public key missing");
    } else if (!verifyPqcAuth(message, ps.signature, pkHex)) {
      errors.push("PQC signature verification failed");
    }
  } else {
    warnings.push("PQC signature absent (research mode)");
  }

  if (opts.maxSignatureAgeMs != null && envelope.createdAt) {
    const age = Date.now() - Date.parse(envelope.createdAt);
    if (Number.isNaN(age)) {
      errors.push("createdAt invalid");
    } else if (age > opts.maxSignatureAgeMs) {
      errors.push("envelope metadata expired");
    }
  }

  return {
    valid: errors.length === 0,
    ok: errors.length === 0,
    errors,
    warnings,
    algorithm: hasPqc ? PQC_ALGORITHM : hasClassical ? CLASSICAL_ALGORITHM : null,
    verifiedAt: new Date().toISOString(),
  };
}

// --- Legacy Phase 8.13 Task 1–4 API (backward compatible wrappers) ---

/**
 * @deprecated use createHybridAuthEnvelope
 */
export function createHybridEnvelope(payload, sigs = {}) {
  return createHybridAuthEnvelope(payload, {
    classicalSignature: sigs.classicalSignature ?? undefined,
    pqcSignature: sigs.pqSignature ?? undefined,
    pqcPublicKeyId: sigs.pqPublicKeyId,
  });
}

/**
 * @deprecated use verifyHybridAuthEnvelope
 */
export function verifyHybridEnvelope(envelope, opts = {}) {
  const migrated = envelope.domain
    ? envelope
    : {
        domain: AUTH_ENVELOPE_DOMAIN,
        version: HYBRID_AUTH_VERSION,
        payload: envelope.payload,
        classicalSignature:
          typeof envelope.classicalSignature === "string"
            ? { algorithm: CLASSICAL_ALGORITHM, signature: envelope.classicalSignature }
            : envelope.classicalSignature ?? null,
        pqcSignature:
          typeof envelope.pqSignature === "string"
            ? { algorithm: PQC_ALGORITHM, signature: envelope.pqSignature, version: PQC_VERSION }
            : envelope.pqcSignature ?? null,
        createdAt: envelope.createdAt,
      };

  const result = verifyHybridAuthEnvelope(migrated, {
    requirePqc: opts.requirePqSignature,
    verifyClassical: opts.verifyClassical
      ? (payload, sig) => opts.verifyClassical(payload, sig)
      : undefined,
  });

  return { ok: result.ok, errors: result.errors, warnings: result.warnings };
}

/** Canonical payload hash (SHA-256 of sorted JSON). */
export function hashPayload(payload) {
  return crypto.createHash("sha256").update(canonicalJson(sortKeysDeep(payload))).digest("hex");
}

/**
 * Build deployment authorization request template (unsigned payload body).
 */
export function createDeploymentAuthPayload(operator, action, metadata = {}) {
  return sortKeysDeep({
    domain: "AEGIS_DEPLOYMENT_AUTH_V1",
    operator,
    action,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

export { generatePqcKeypair };
