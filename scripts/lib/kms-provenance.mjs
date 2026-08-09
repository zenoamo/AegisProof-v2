// Provenance manifest signing via KMS signer (Phase 8.14 Task 4).
import {
  createSigner,
  signPayload,
  verifySignedPayload,
  BACKEND_VAULT_TRANSIT,
  SIGNER_ROLE_PROVENANCE,
  KmsSecurityError,
} from "./kms-signer.mjs";
import { isExplicitLiveMode } from "./kms-backends/env.mjs";
import { loadRegistryPublicKey } from "./public-key-registry.mjs";
import {
  PQC_ALGORITHM_VERSION,
  PQC_VERSION,
  entrySignPayload,
} from "./pqc-signature.mjs";

export const DEFAULT_PROVENANCE_KMS_KEY_ID = "aegis-ci-mldsa87-v1";

/** @param {unknown} signature */
export function isVaultStubSignature(signature) {
  return typeof signature === "string" && signature.startsWith("vault-stub-");
}

/**
 * Validate KMS envelope metadata consistency before verification.
 * Manifest-supplied kmsStub/kmsLive/signature must agree.
 * @param {object} env
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validateKmsEnvelopeMetadata(env) {
  const stubSig = isVaultStubSignature(env?.signature);
  const kmsStub = Boolean(env?.kmsStub);
  const kmsLive = Boolean(env?.kmsLive);

  if (kmsStub && kmsLive) {
    return {
      ok: false,
      code: "KMS_ENVELOPE_METADATA_CONFLICT",
      error: "kmsStub and kmsLive cannot both be true",
    };
  }

  if (stubSig && kmsLive) {
    return {
      ok: false,
      code: "KMS_ENVELOPE_METADATA_CONFLICT",
      error: "vault-stub signature cannot accompany kmsLive=true",
    };
  }

  if (kmsStub && !stubSig) {
    return {
      ok: false,
      code: "KMS_STUB_METADATA_MISMATCH",
      error: "kmsStub=true requires vault-stub-* signature format",
    };
  }

  if (stubSig && !kmsStub) {
    return {
      ok: false,
      code: "KMS_STUB_METADATA_MISMATCH",
      error: "vault-stub-* signature requires kmsStub=true",
    };
  }

  return { ok: true };
}

/**
 * Stub KMS provenance envelopes are forbidden when the verifier runs in live mode.
 * @param {object} env
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function rejectKmsStubInLiveMode(env) {
  if (!isExplicitLiveMode()) {
    return { ok: true };
  }
  if (env?.kmsStub || isVaultStubSignature(env?.signature)) {
    return {
      ok: false,
      code: "KMS_STUB_FORBIDDEN_IN_LIVE_MODE",
      error: "stub KMS provenance forbidden when KMS_BACKEND_MODE=live",
    };
  }
  return { ok: true };
}

/**
 * Whether manifest generation should use KMS signing instead of local private key.
 */
export function shouldUseKmsProvenanceSigning() {
  const mode = (process.env.AEGIS_PROVENANCE_SIGNING ?? "").trim().toLowerCase();
  if (mode === "kms") return true;
  if (mode === "local") return false;
  return isExplicitLiveMode();
}

/**
 * Create KMS signer for provenance entries from environment.
 */
export function createProvenanceKmsSigner() {
  const backend = (process.env.AEGIS_PROVENANCE_BACKEND ?? BACKEND_VAULT_TRANSIT).trim();
  const keyId = (process.env.AEGIS_PROVENANCE_KEY_ID ?? DEFAULT_PROVENANCE_KMS_KEY_ID).trim();
  return createSigner({
    backend,
    keyId,
    role: SIGNER_ROLE_PROVENANCE,
  });
}

/**
 * Map KMS signature result to manifest PQC envelope (hash semantics unchanged).
 * @param {object} entry
 * @param {object} signatureResult
 * @param {string} publicKeyHex
 */
export function kmsSignatureToEnvelope(entry, signatureResult, publicKeyHex) {
  return {
    status: "signed",
    algorithmVersion: PQC_ALGORITHM_VERSION,
    version: PQC_VERSION,
    signature: signatureResult.signature,
    publicKey: publicKeyHex,
    publicKeyId: signatureResult.keyId,
    signedAt: signatureResult.signedAt ?? new Date().toISOString(),
    kmsBackend: signatureResult.backend,
    kmsLive: Boolean(signatureResult.live),
    kmsStub: Boolean(signatureResult.stub),
  };
}

/**
 * Sign a single manifest entry via KMS.
 * @param {object} entry
 * @param {object} signer
 */
export async function signEntryWithKms(entry, signer) {
  if (!entry.present || !entry.sha256) {
    return entry;
  }
  const payload = entrySignPayload(entry);
  const signatureResult = await signPayload(signer, payload);
  const record = loadRegistryPublicKey(signer.keyId);
  const publicKeyHex = record?.publicKey ?? signatureResult.publicKey ?? null;
  return {
    ...entry,
    pqcSignatureEnvelope: kmsSignatureToEnvelope(entry, signatureResult, publicKeyHex),
  };
}

/**
 * Sign all present entries via KMS. Throws on signing failure in live mode.
 * @param {object} manifest
 * @param {object} [signer]
 */
export async function signManifestWithKms(manifest, signer = createProvenanceKmsSigner()) {
  const entries = [];
  for (const entry of manifest.entries) {
    if (!entry.present || !entry.sha256) {
      entries.push(entry);
      continue;
    }
    try {
      entries.push(await signEntryWithKms(entry, signer));
    } catch (err) {
      if (isExplicitLiveMode()) {
        throw err instanceof KmsSecurityError
          ? err
          : new KmsSecurityError("KMS_SIGN_FAILED", err instanceof Error ? err.message : String(err));
      }
      entries.push(entry);
    }
  }

  const signedCount = entries.filter((e) => e.pqcSignatureEnvelope?.status === "signed").length;
  if (isExplicitLiveMode() && signedCount === 0) {
    throw new KmsSecurityError("KMS_SIGN_FAILED", "live provenance signing produced zero signed entries");
  }

  return {
    ...manifest,
    entries,
    pqcPolicy: {
      ...manifest.pqcPolicy,
      pqcSignatureRequired: isExplicitLiveMode(),
      signingKeyId: signer.keyId,
      signingBackend: signer.backend,
      signedAt: new Date().toISOString(),
      kmsLive: isExplicitLiveMode(),
    },
  };
}

/**
 * Verify KMS-signed envelope via kms-signer (Vault Transit verify path).
 * @param {object} entry
 * @param {object} signer
 */
export async function verifyEntryKms(entry, signer) {
  const env = entry.pqcSignatureEnvelope;
  if (!env || env.status !== "signed" || !env.signature) {
    return { ok: false, error: env?.status === "placeholder" ? "legacy placeholder" : "unsigned" };
  }

  if (!env.kmsBackend) {
    return { ok: false, error: "not a KMS envelope" };
  }

  const metaCheck = validateKmsEnvelopeMetadata(env);
  if (!metaCheck.ok) {
    return { ok: false, error: metaCheck.error, code: metaCheck.code };
  }

  const liveStubCheck = rejectKmsStubInLiveMode(env);
  if (!liveStubCheck.ok) {
    return { ok: false, error: liveStubCheck.error, code: liveStubCheck.code };
  }

  const payload = entrySignPayload(entry);
  const stubSig = isVaultStubSignature(env.signature);
  const signatureResult = {
    signature: env.signature,
    signedAt: env.signedAt,
    live: Boolean(env.kmsLive),
    stub: stubSig && Boolean(env.kmsStub),
    backend: env.kmsBackend,
  };

  return verifySignedPayload(signer, payload, signatureResult);
}

/**
 * Verify KMS layer when manifest entries carry kmsBackend envelopes.
 * No-op when no KMS envelopes present (hash-only manifests).
 * @param {object} manifest
 * @param {object} [signer]
 */
export async function verifyManifestKmsLayer(manifest, signer = createProvenanceKmsSigner()) {
  const hasKms = (manifest.entries ?? []).some((e) => e.pqcSignatureEnvelope?.kmsBackend);
  if (!hasKms) {
    return { ok: true, errors: [], verifiedCount: 0 };
  }
  return verifyManifestKmsEntries(manifest, signer);
}

/**
 * Verify KMS-signed entries in manifest (async — Vault Transit verify).
 * @param {object} manifest
 * @param {object} [signer]
 */
export async function verifyManifestKmsEntries(manifest, signer = createProvenanceKmsSigner()) {
  const errors = [];
  let verifiedCount = 0;

  for (const entry of manifest.entries ?? []) {
    const env = entry.pqcSignatureEnvelope;
    if (!env?.kmsBackend) continue;
    const result = await verifyEntryKms(entry, signer);
    if (!result.ok) {
      errors.push(`KMS verify failed: ${entry.artifact}: ${result.error}`);
    } else {
      verifiedCount++;
    }
  }

  return { ok: errors.length === 0, errors, verifiedCount };
}
