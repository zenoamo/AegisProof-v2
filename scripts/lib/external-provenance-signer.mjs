// ============================================================================
// External ML-DSA-87 provenance signer.
// The signer callback returns a signature for canonical entry bytes.
// Signer identity is the explicit keyId, never inferred from signature bytes.
// This module does not read, write, or accept private-key material.
// ML-DSA-87 here authenticates provenance metadata. It does not sign Groth16 proofs.
// ============================================================================
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import {
  loadRegistryPublicKey,
  validateRegistryKeyLifecycle,
  validateRegistryRecord,
} from "./public-key-registry.mjs";
import {
  PQC_ALGORITHM,
  PQC_VERSION,
  buildSignMessage,
  bytesToHex,
  entrySignPayload,
  generateKeypair,
} from "./pqc-signature.mjs";

export const PRODUCTION_PROVENANCE_KEY_ID = "aegis-provenance-prod-v1";
export const CI_PROVENANCE_KEY_ID = "aegis-ci-mldsa87-v1";
export const PRODUCTION_SIGNING_KEY_NOT_PROVISIONED = "PRODUCTION SIGNING KEY NOT PROVISIONED";
export const PROVISIONING_UNPROVISIONED = "UNPROVISIONED";
export const PROVISIONING_PROVISIONED = "PROVISIONED";
export const PROVISIONING_INVALID = "INVALID";
/** FIPS 204 ML-DSA-87 public key size. A shorter hex string is not a production key. */
export const ML_DSA_87_PUBLIC_KEY_BYTES = 2592;

const SECRET_FIELDS = [
  "privateKey",
  "privateKeyHex",
  "secretKey",
  "secretKeyHex",
  "mnemonic",
  "password",
  "seed",
];

export class ExternalSignerError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExternalSignerError";
  }
}

/** Canonical bytes that an external signer must sign. */
export function canonicalEntrySigningBytes(entry) {
  return buildSignMessage(entrySignPayload(entry));
}

/**
 * Reject signer objects that carry secret material.
 * @param {object} signer
 */
export function assertExternalSigner(signer) {
  if (!signer || typeof signer !== "object") {
    throw new ExternalSignerError("external signer is required");
  }
  for (const field of SECRET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(signer, field) && signer[field] != null) {
      throw new ExternalSignerError(`external signer must not carry ${field}`);
    }
  }
  if (typeof signer.signMessage !== "function") {
    throw new ExternalSignerError("external signer signMessage(canonicalBytes) is required");
  }
  if (typeof signer.keyId !== "string" || signer.keyId.length === 0) {
    throw new ExternalSignerError("external signer keyId is required");
  }
  if (typeof signer.publicKeyHex !== "string" || !/^[0-9a-fA-F]+$/.test(signer.publicKeyHex)) {
    throw new ExternalSignerError("external signer publicKeyHex is required");
  }
  const algorithm = signer.algorithm ?? PQC_ALGORITHM;
  if (algorithm !== PQC_ALGORITHM) {
    throw new ExternalSignerError(`external signer algorithm must be ${PQC_ALGORITHM}`);
  }
}

function signatureFromSigner(signer, message) {
  const result = signer.signMessage(message);
  if (typeof result === "string") {
    return result;
  }
  if (result && typeof result === "object" && typeof result.signature === "string") {
    if (result.keyId != null && result.keyId !== signer.keyId) {
      throw new ExternalSignerError("signature keyId does not match signer keyId");
    }
    return result.signature;
  }
  throw new ExternalSignerError("external signer must return a hex ML-DSA-87 signature");
}

/**
 * Sign one present entry. publicKeyId is copied from the signer, not derived
 * from the signature.
 * @param {object} entry
 * @param {object} signer
 */
export function signEntryWithExternalSigner(entry, signer) {
  assertExternalSigner(signer);
  if (!entry?.present || !entry.sha256) return entry;
  const signature = signatureFromSigner(signer, canonicalEntrySigningBytes(entry));
  if (!/^[0-9a-fA-F]+$/.test(signature) || signature.length === 0) {
    throw new ExternalSignerError("external signer must return a hex ML-DSA-87 signature");
  }
  return {
    ...entry,
    pqcSignatureEnvelope: {
      status: "signed",
      algorithmVersion: PQC_ALGORITHM,
      version: PQC_VERSION,
      signature,
      publicKey: signer.publicKeyHex,
      publicKeyId: signer.keyId,
      signedAt: new Date().toISOString(),
    },
  };
}

/**
 * Sign present entries. Absent entries stay unsigned.
 * Does not write the manifest.
 * @param {object} manifest
 * @param {object} signer
 */
export function signManifestWithExternalSigner(manifest, signer) {
  assertExternalSigner(signer);
  return {
    ...manifest,
    entries: (manifest?.entries ?? []).map((entry) => signEntryWithExternalSigner(entry, signer)),
    pqcPolicy: {
      ...(manifest?.pqcPolicy ?? {}),
      algorithmVersion: PQC_ALGORITHM,
      version: PQC_VERSION,
      signingKeyId: signer.keyId,
    },
  };
}

/**
 * In-memory test signer. The secret stays in the closure and is not a field.
 * Test key ids must start with "test-" and must not reuse production or CI ids.
 * @param {{ keyId: string, keypair?: { secretKey: Uint8Array, publicKeyHex: string } }} options
 */
export function createInMemoryTestSigner(options) {
  const keyId = options?.keyId;
  if (typeof keyId !== "string" || !keyId.startsWith("test-")) {
    throw new ExternalSignerError("test signer keyId must start with test-");
  }
  if (keyId === PRODUCTION_PROVENANCE_KEY_ID || keyId === CI_PROVENANCE_KEY_ID) {
    throw new ExternalSignerError("test signer must not use a production or CI key id");
  }
  const material = options.keypair ?? generateKeypair();
  const secret = material.secretKey;
  const signer = {
    identity: "test",
    algorithm: PQC_ALGORITHM,
    keyId,
    publicKeyHex: material.publicKeyHex,
    signMessage(message) {
      const signature = ml_dsa87.sign(message, secret);
      return { signature: bytesToHex(signature), keyId };
    },
  };
  assertExternalSigner(signer);
  return signer;
}

function hexNorm(value) {
  return String(value ?? "").replace(/^0x/, "").toLowerCase();
}

function provisioningResult(state, extra = {}) {
  return {
    state,
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    algorithm: PQC_ALGORITHM,
    provisioned: state === PROVISIONING_PROVISIONED,
    registered: state !== PROVISIONING_UNPROVISIONED,
    lifecycle: extra.lifecycle ?? null,
    status:
      state === PROVISIONING_UNPROVISIONED
        ? PRODUCTION_SIGNING_KEY_NOT_PROVISIONED
        : state === PROVISIONING_PROVISIONED
          ? "PRODUCTION SIGNING KEY REGISTERED"
          : "PRODUCTION SIGNING KEY INVALID",
    reason: extra.reason ?? null,
    record: extra.record ?? null,
  };
}

/**
 * Classify an operator-supplied production public key.
 * Null means the key is absent. This function never generates or writes a key.
 * @param {object | null | undefined} record
 * @param {{ ciPublicKey?: string | null }} [opts]
 */
export function classifyProductionProvisioning(record, opts = {}) {
  if (record == null) {
    return provisioningResult(PROVISIONING_UNPROVISIONED, {
      reason: "production public key is not registered",
    });
  }
  for (const field of SECRET_FIELDS) {
    if (record[field] != null) {
      return provisioningResult(PROVISIONING_INVALID, {
        reason: `production record carries ${field}`,
      });
    }
  }
  const validated = validateRegistryRecord(record, record.keyId ?? record.publicKeyId ?? PRODUCTION_PROVENANCE_KEY_ID);
  if (!validated.ok) {
    return provisioningResult(PROVISIONING_INVALID, { reason: validated.errors.join("; ") });
  }
  const normalized = validated.record;
  if (normalized.keyId !== PRODUCTION_PROVENANCE_KEY_ID) {
    return provisioningResult(PROVISIONING_INVALID, {
      reason: `publicKeyId mismatch: ${normalized.keyId}`,
    });
  }
  if (normalized.algorithm !== PQC_ALGORITHM) {
    return provisioningResult(PROVISIONING_INVALID, {
      reason: `algorithm mismatch: ${normalized.algorithm}`,
    });
  }
  if (hexNorm(normalized.publicKey).length !== ML_DSA_87_PUBLIC_KEY_BYTES * 2) {
    return provisioningResult(PROVISIONING_INVALID, { reason: "malformed ML-DSA-87 public key" });
  }
  const lifecycle = validateRegistryKeyLifecycle(normalized, { requireActive: true });
  if (!lifecycle.ok) {
    return provisioningResult(PROVISIONING_INVALID, {
      lifecycle: normalized.status,
      reason: lifecycle.errors.join("; "),
    });
  }
  const ciPublicKey = opts.ciPublicKey === undefined
    ? loadRegistryPublicKey(CI_PROVENANCE_KEY_ID)?.publicKey
    : opts.ciPublicKey;
  if (ciPublicKey && hexNorm(ciPublicKey) === hexNorm(normalized.publicKey)) {
    return provisioningResult(PROVISIONING_INVALID, {
      reason: "CI public key cannot be reused as production identity",
    });
  }
  return provisioningResult(PROVISIONING_PROVISIONED, {
    lifecycle: normalized.status,
    reason: "production public key is registered for ML-DSA-87",
    record: normalized,
  });
}

/**
 * Production public-key registration. Absence is explicit.
 * Registration is not a signed manifest and is not PROVENANCE VERIFIED.
 * A thrown registry read is INVALID. A missing record stays UNPROVISIONED.
 * @param {(keyId: string) => { publicKey?: string, algorithm?: string, status?: string } | null} [lookup]
 */
export function productionSigningKeyStatus(lookup = loadRegistryPublicKey) {
  try {
    return classifyProductionProvisioning(lookup(PRODUCTION_PROVENANCE_KEY_ID));
  } catch (error) {
    return provisioningResult(PROVISIONING_INVALID, {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sign with the external production signer only.
 * Does not read a local private key, does not accept a test identity,
 * and does not infer identity from signature bytes.
 * @param {object} manifest
 * @param {object | null | undefined} signer
 * @param {{ record?: object | null }} [opts]
 */
export function signManifestWithProductionSigner(manifest, signer, opts = {}) {
  const provisioning = classifyProductionProvisioning(opts.record ?? null, opts);
  if (provisioning.state === PROVISIONING_UNPROVISIONED) {
    throw new ExternalSignerError(PRODUCTION_SIGNING_KEY_NOT_PROVISIONED);
  }
  if (provisioning.state !== PROVISIONING_PROVISIONED) {
    throw new ExternalSignerError(`production provisioning INVALID: ${provisioning.reason}`);
  }
  if (signer == null || typeof signer.signMessage !== "function") {
    throw new ExternalSignerError("production signer unavailable");
  }
  if (signer.identity === "test" || String(signer.keyId ?? "").startsWith("test-")) {
    throw new ExternalSignerError("test signer cannot sign as production identity");
  }
  if (!signer.identity) {
    throw new ExternalSignerError("signer identity missing");
  }
  if (signer.identity !== "production" || signer.keyId !== PRODUCTION_PROVENANCE_KEY_ID) {
    throw new ExternalSignerError("signer identity does not match requested production identity");
  }
  if (hexNorm(signer.publicKeyHex) !== hexNorm(provisioning.record.publicKey)) {
    throw new ExternalSignerError("signer public key does not match provisioned production public key");
  }
  assertExternalSigner(signer);
  const bound = {
    identity: "production",
    algorithm: PQC_ALGORITHM,
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    publicKeyHex: signer.publicKeyHex,
    signMessage(message) {
      const result = signer.signMessage(message);
      if (!result || typeof result !== "object") {
        throw new ExternalSignerError("production signer must return signature and publicKeyId");
      }
      const returnedId = result.publicKeyId ?? result.keyId;
      if (!returnedId) throw new ExternalSignerError("signer identity missing");
      if (returnedId !== PRODUCTION_PROVENANCE_KEY_ID) {
        throw new ExternalSignerError("signature keyId does not match requested production identity");
      }
      if (typeof result.signature !== "string" || !/^[0-9a-fA-F]+$/.test(result.signature)) {
        throw new ExternalSignerError("external signer must return a hex ML-DSA-87 signature");
      }
      return { signature: result.signature, keyId: returnedId };
    },
  };
  return signManifestWithExternalSigner(manifest, bound);
}

/**
 * Production provenance VERIFIED is the conjunction of a registered production
 * public key, a manifest signed by that key id, and signature status VERIFIED.
 * A test-key verification does not satisfy it.
 */
export function isProductionProvenanceVerified(input) {
  if (input?.provisioningState != null && input.provisioningState !== PROVISIONING_PROVISIONED) {
    return false;
  }
  return (
    input?.productionKeyProvisioned === true &&
    input?.manifestSignedByProductionKeyId === true &&
    input?.manifestSignatureStatus === "VERIFIED"
  );
}

function signedByProductionKey(manifest) {
  const present = (manifest?.entries ?? []).filter((entry) => entry?.present !== false && entry?.sha256);
  if (!present.length) return false;
  const ids = new Set(
    present.map((entry) => entry?.pqcSignatureEnvelope?.publicKeyId).filter((id) => typeof id === "string" && id.length > 0)
  );
  return ids.size === 1 && ids.has(PRODUCTION_PROVENANCE_KEY_ID);
}

/**
 * Separate manifest signature status from production identity.
 * @param {object | null | undefined} manifest
 * @param {{ signature?: object, lookup?: (id: string) => object | null }} [opts]
 */
export function assessProductionProvenance(manifest, opts = {}) {
  const lookup = opts.lookup ?? loadRegistryPublicKey;
  const keyStatus = productionSigningKeyStatus(lookup);
  const signature = opts.signature;
  if (!signature?.status) {
    throw new ExternalSignerError("assessProductionProvenance requires the existing signature classification");
  }
  const manifestSignedByProductionKeyId = signedByProductionKey(manifest);
  const productionProvenanceVerified = isProductionProvenanceVerified({
    provisioningState: keyStatus.state,
    productionKeyProvisioned: keyStatus.state === PROVISIONING_PROVISIONED,
    manifestSignedByProductionKeyId,
    manifestSignatureStatus: signature.status,
  });

  let productionOutcome = "NOT_VERIFIED";
  if (keyStatus.state === PROVISIONING_UNPROVISIONED) productionOutcome = "NOT_PROVISIONED";
  else if (keyStatus.state === PROVISIONING_INVALID) productionOutcome = "FAIL";
  else if (productionProvenanceVerified) productionOutcome = "VERIFIED";
  else if (signature.status === "FAIL") productionOutcome = "FAIL";
  else if (signature.status === "NOT_RUN") productionOutcome = "NOT_RUN";

  return {
    manifestSignature: signature.status,
    productionKeyStatus: keyStatus.status,
    productionKeyId: PRODUCTION_PROVENANCE_KEY_ID,
    provisioningState: keyStatus.state,
    provisioningReason: keyStatus.reason,
    productionKeyProvisioned: keyStatus.state === PROVISIONING_PROVISIONED,
    manifestSignedByProductionKeyId,
    productionProvenanceVerified,
    productionOutcome,
  };
}

/** Lines that keep production identity distinct from manifest signature status. */
export function formatProductionProvenanceStatus(assessment) {
  const lines = [];
  if (assessment.provisioningState) {
    lines.push(`production provisioning: ${assessment.provisioningState}`);
  }
  if (assessment.provisioningState === PROVISIONING_INVALID && assessment.provisioningReason) {
    lines.push(`production provisioning reason: ${assessment.provisioningReason}`);
  }
  if (assessment.productionKeyStatus === PRODUCTION_SIGNING_KEY_NOT_PROVISIONED) {
    lines.push(PRODUCTION_SIGNING_KEY_NOT_PROVISIONED);
  } else {
    lines.push(`production signing key: ${assessment.productionKeyStatus}`);
  }
  if (assessment.productionProvenanceVerified) lines.push("production provenance: VERIFIED");
  else if (assessment.productionOutcome === "FAIL") lines.push("production provenance: FAIL");
  else if (assessment.productionOutcome === "NOT_RUN") lines.push("production provenance: NOT RUN");
  else lines.push("production provenance: NOT VERIFIED");
  if (assessment.manifestSignature === "VERIFIED" && !assessment.productionProvenanceVerified) {
    lines.push("test or non-production signature verification is not production provenance VERIFIED");
  }
  return lines;
}
