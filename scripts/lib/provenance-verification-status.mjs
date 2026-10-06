// ============================================================================
// Separate PQC key-rotation evidence from manifest signature verification.
// Rotation PASS does not make an unsigned manifest VERIFIED.
// ML-DSA-87 here is provenance metadata authenticity, not a Groth16 signature.
// ============================================================================
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { entrySignPayload, verifyEnvelope } from "./pqc-signature.mjs";
import { loadRegistryPublicKey, validateKeyRotationChain } from "./public-key-registry.mjs";

export const EXIT_PROVENANCE_VERIFIED = 0;
export const EXIT_PROVENANCE_FAIL = 1;
export const EXIT_PROVENANCE_NOT_VERIFIED = 2;
export const EXIT_PROVENANCE_NOT_RUN = 3;

function hex(value) {
  return String(value ?? "").replace(/^0x/, "").toLowerCase();
}

/**
 * @param {object | null | undefined} manifest
 * @param {{ verifierAvailable?: boolean, publicKeyOverride?: string, resolvePublicKey?: (id: string) => { publicKey?: string } | null, maxSignatureAgeMs?: number, requireRegistry?: boolean }} [opts]
 */
export function classifyManifestSignatures(manifest, opts = {}) {
  const empty = {
    status: "NOT_VERIFIED",
    reason: "no manifest entries",
    unsigned: [],
    signedVerified: [],
    bindingUnavailable: [],
    invalid: [],
    signerBinding: "unavailable",
    provenanceVerified: false,
  };

  if (opts.verifierAvailable === false || typeof ml_dsa87?.verify !== "function") {
    return {
      ...empty,
      status: "NOT_RUN",
      reason: "PQC verifier unavailable",
    };
  }

  const entries = manifest?.entries ?? [];
  if (!entries.length) return empty;

  const unsigned = [];
  const signedVerified = [];
  const bindingUnavailable = [];
  const invalid = [];

  for (const entry of entries) {
    const name = entry?.artifact ?? "(unnamed)";
    const env = entry?.pqcSignatureEnvelope;
    const signed = env?.status === "signed" && typeof env.signature === "string" && env.signature.length > 0;
    if (!signed) {
      unsigned.push(name);
      continue;
    }

    const keyId = env.publicKeyId ?? env.keyId ?? null;
    const record = keyId
      ? (opts.resolvePublicKey ? opts.resolvePublicKey(keyId) : loadRegistryPublicKey(keyId))
      : null;
    const verificationKey = opts.publicKeyOverride ?? record?.publicKey ?? env.publicKey ?? undefined;

    let result;
    try {
      result = verifyEnvelope(entrySignPayload(entry), env, verificationKey, {
        maxSignatureAgeMs: opts.maxSignatureAgeMs,
        requireRegistry: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unavailable|cannot find module|is not a function/i.test(message)) {
        return {
          status: "NOT_RUN",
          reason: "PQC verifier unavailable",
          unsigned,
          signedVerified,
          bindingUnavailable,
          invalid,
          signerBinding: "unavailable",
          provenanceVerified: false,
        };
      }
      invalid.push({ artifact: name, error: message });
      continue;
    }

    if (!result.ok) {
      invalid.push({ artifact: name, error: result.error ?? "invalid signature" });
      continue;
    }

    if (!keyId) {
      bindingUnavailable.push(name);
      continue;
    }
    if (!record?.publicKey) {
      invalid.push({ artifact: name, error: `unknown publicKeyId: ${keyId}` });
      continue;
    }

    const recordKey = hex(record.publicKey);
    const embedded = env.publicKey ? hex(env.publicKey) : null;
    if (embedded && embedded !== recordKey) {
      invalid.push({ artifact: name, error: `signer binding failed: public key mismatch for ${keyId}` });
      continue;
    }
    if (opts.publicKeyOverride && hex(opts.publicKeyOverride) !== recordKey) {
      invalid.push({ artifact: name, error: `signer binding failed: verification key is not ${keyId}` });
      continue;
    }

    signedVerified.push(name);
  }

  if (invalid.length) {
    return {
      status: "FAIL",
      reason: invalid.map((item) => `${item.artifact}: ${item.error}`).join("; "),
      unsigned,
      signedVerified,
      bindingUnavailable,
      invalid,
      signerBinding: bindingUnavailable.length ? "unavailable" : "checked",
      provenanceVerified: false,
    };
  }

  if (unsigned.length || bindingUnavailable.length) {
    const reason = unsigned.length
      ? "unsigned entries present"
      : "signer binding unavailable";
    return {
      status: "NOT_VERIFIED",
      reason,
      unsigned,
      signedVerified,
      bindingUnavailable,
      invalid,
      signerBinding: bindingUnavailable.length ? "unavailable" : "checked",
      provenanceVerified: false,
    };
  }

  return {
    status: "VERIFIED",
    reason: "signed entries verified",
    unsigned,
    signedVerified,
    bindingUnavailable,
    invalid,
    signerBinding: "checked",
    provenanceVerified: true,
  };
}

/**
 * Rotation evidence is a key-lifecycle record. It is not a manifest signature.
 * @param {unknown[] | null | undefined} records
 * @param {Map<string, object> | Record<string, object> | null} [registry]
 */
export function classifyRotationEvidence(records, registry = null) {
  if (records == null || (Array.isArray(records) && records.length === 0)) {
    return {
      status: "NOT_RUN",
      reason: "rotation evidence absent",
      errors: [],
      countsAsManifestVerified: false,
    };
  }
  if (!Array.isArray(records)) {
    return {
      status: "FAIL",
      reason: "rotation evidence must be an array",
      errors: ["rotation evidence must be an array"],
      countsAsManifestVerified: false,
    };
  }
  const result = validateKeyRotationChain(records, registry ?? {});
  return {
    status: result.ok ? "PASS" : "FAIL",
    reason: result.ok ? "rotation evidence accepted" : result.errors.join("; "),
    errors: result.errors,
    countsAsManifestVerified: false,
  };
}

/** Rotation PASS never promotes an unsigned or invalid manifest to VERIFIED. */
export function separateProvenanceResults(rotation, signature) {
  return {
    rotationEvidence: rotation.status,
    manifestSignature: signature.status,
    provenanceVerified: signature.status === "VERIFIED",
    rotationCountsAsManifestVerified: false,
  };
}

export function isPqcAbsenceError(error) {
  return (
    error.startsWith("PQC signature required but absent") ||
    error.startsWith("PQC signature absent") ||
    error.startsWith("PQC placeholder")
  );
}

/**
 * @param {{ signature: ReturnType<typeof classifyManifestSignatures>, rotation: ReturnType<typeof classifyRotationEvidence>, pqcRequired: boolean, hardErrors?: string[] }} input
 */
export function decideProvenanceExit(input) {
  const hardErrors = input.hardErrors ?? [];
  const signature = input.signature;
  const rotation = input.rotation;

  if (!input.pqcRequired) {
    return {
      exitCode: hardErrors.length ? EXIT_PROVENANCE_FAIL : EXIT_PROVENANCE_VERIFIED,
      outcome: signature.status === "VERIFIED" && hardErrors.length === 0 ? "VERIFIED" : signature.status,
      enforceSignature: false,
    };
  }

  if (signature.status === "NOT_RUN") {
    return { exitCode: EXIT_PROVENANCE_NOT_RUN, outcome: "NOT_RUN", enforceSignature: true };
  }
  if (signature.status === "FAIL" || rotation.status === "FAIL" || hardErrors.length) {
    return { exitCode: EXIT_PROVENANCE_FAIL, outcome: "FAIL", enforceSignature: true };
  }
  if (signature.status === "VERIFIED") {
    return { exitCode: EXIT_PROVENANCE_VERIFIED, outcome: "VERIFIED", enforceSignature: true };
  }
  return { exitCode: EXIT_PROVENANCE_NOT_VERIFIED, outcome: "NOT_VERIFIED", enforceSignature: true };
}

export function formatProvenanceStatus(rotation, signature, decision) {
  const lines = [];
  if (rotation.status === "PASS") lines.push("PQC key rotation evidence: PASS");
  else if (rotation.status === "FAIL") lines.push("PQC key rotation evidence: FAIL");
  else lines.push("PQC key rotation evidence: NOT RUN");
  if (rotation.reason) lines.push(`Reason: ${rotation.reason}`);

  if (signature.status === "VERIFIED") lines.push("Provenance manifest signature: VERIFIED");
  else if (signature.status === "FAIL") lines.push("Provenance manifest signature: FAIL");
  else if (signature.status === "NOT_RUN") lines.push("Provenance manifest signature: NOT RUN");
  else lines.push("Provenance manifest signature: NOT VERIFIED");

  if (signature.reason) lines.push(`Reason: ${signature.reason}`);
  if (signature.signedVerified?.length) {
    lines.push(`SIGNED ENTRIES VERIFIED: ${signature.signedVerified.join(", ")}`);
  }
  if (signature.unsigned?.length) {
    lines.push(`UNSIGNED ENTRIES PRESENT: ${signature.unsigned.join(", ")}`);
  }
  if (signature.signerBinding === "unavailable") lines.push("signer binding unavailable");

  if (decision.outcome === "VERIFIED") lines.push("PROVENANCE VERIFIED");
  else if (decision.outcome === "NOT_VERIFIED") lines.push("PROVENANCE NOT VERIFIED");
  else if (decision.outcome === "NOT_RUN") lines.push("PROVENANCE NOT RUN");
  else lines.push("PROVENANCE FAIL");

  lines.push("ML-DSA-87 authenticates provenance metadata. It is not a Groth16 proof signature.");
  return lines;
}
