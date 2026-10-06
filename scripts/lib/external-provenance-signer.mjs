// ============================================================================
// External ML-DSA-87 provenance signer.
// The signer callback returns a signature for canonical entry bytes.
// Signer identity is the explicit keyId, never inferred from signature bytes.
// This module does not read, write, or accept private-key material.
// ML-DSA-87 here authenticates provenance metadata. It does not sign Groth16 proofs.
// ============================================================================
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { loadRegistryPublicKey } from "./public-key-registry.mjs";
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

/**
 * Production public-key registration. Absence is explicit.
 * Registration is not a signed manifest and is not PROVENANCE VERIFIED.
 * @param {(keyId: string) => { publicKey?: string, algorithm?: string, status?: string } | null} [lookup]
 */
export function productionSigningKeyStatus(lookup = loadRegistryPublicKey) {
  let record = null;
  try {
    record = lookup(PRODUCTION_PROVENANCE_KEY_ID);
  } catch {
    record = null;
  }
  if (!record?.publicKey) {
    return {
      keyId: PRODUCTION_PROVENANCE_KEY_ID,
      algorithm: PQC_ALGORITHM,
      provisioned: false,
      registered: false,
      lifecycle: null,
      status: PRODUCTION_SIGNING_KEY_NOT_PROVISIONED,
    };
  }
  return {
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    algorithm: record.algorithm ?? PQC_ALGORITHM,
    provisioned: true,
    registered: true,
    lifecycle: record.status ?? "active",
    status: "PRODUCTION SIGNING KEY REGISTERED",
  };
}

/**
 * Production provenance VERIFIED is the conjunction of a registered production
 * public key, a manifest signed by that key id, and signature status VERIFIED.
 * A test-key verification does not satisfy it.
 */
export function isProductionProvenanceVerified(input) {
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
    productionKeyProvisioned: keyStatus.provisioned,
    manifestSignedByProductionKeyId,
    manifestSignatureStatus: signature.status,
  });

  let productionOutcome = "NOT_VERIFIED";
  if (!keyStatus.provisioned) productionOutcome = "NOT_PROVISIONED";
  else if (productionProvenanceVerified) productionOutcome = "VERIFIED";
  else if (signature.status === "FAIL") productionOutcome = "FAIL";
  else if (signature.status === "NOT_RUN") productionOutcome = "NOT_RUN";

  return {
    manifestSignature: signature.status,
    productionKeyStatus: keyStatus.status,
    productionKeyId: PRODUCTION_PROVENANCE_KEY_ID,
    productionKeyProvisioned: keyStatus.provisioned,
    manifestSignedByProductionKeyId,
    productionProvenanceVerified,
    productionOutcome,
  };
}

/** Lines that keep production identity distinct from manifest signature status. */
export function formatProductionProvenanceStatus(assessment) {
  const lines = [];
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
