// Final production provenance E2E gate.
// VERIFIED is reached only through a live external production signer.
// A missing credential stays UNPROVISIONED / NOT VERIFIED. Test keys do not promote it.
import { entrySignPayload } from "./pqc-signature.mjs";
import { loadRegistryPublicKey } from "./public-key-registry.mjs";
import {
  CI_PROVENANCE_KEY_ID,
  PRODUCTION_PROVENANCE_KEY_ID,
  PRODUCTION_SIGNING_KEY_NOT_PROVISIONED,
  PROVISIONING_INVALID,
  PROVISIONING_PROVISIONED,
  PROVISIONING_UNPROVISIONED,
  ExternalSignerError,
  assessProductionProvenance,
  canonicalEntrySigningBytes,
  formatProductionProvenanceStatus,
  productionSigningKeyStatus,
  signManifestWithProductionSigner,
  signManifestWithProductionSignerAsync,
} from "./external-provenance-signer.mjs";
import {
  EXIT_PROVENANCE_FAIL,
  EXIT_PROVENANCE_NOT_RUN,
  EXIT_PROVENANCE_NOT_VERIFIED,
  EXIT_PROVENANCE_VERIFIED,
  classifyManifestSignatures,
  classifyRotationEvidence,
  decideProvenanceExit,
  formatProvenanceStatus,
} from "./provenance-verification-status.mjs";

const LIVE_PRODUCTION_SIGNER = Symbol("aegis-live-production-signer");
const SECRET_MARKERS = ["secretKey", "secretKeyHex", "privateKey", "privateKeyHex", "seed"];

export function detectProductionCredentialSource(env = {}) {
  const signing = String(env.AEGIS_PROVENANCE_SIGNING ?? "").trim().toLowerCase();
  const keyId = String(env.AEGIS_PROVENANCE_KEY_ID ?? "").trim();
  const mode = String(env.KMS_BACKEND_MODE ?? "").trim().toLowerCase();
  if (signing !== "kms" || mode !== "live") return null;
  if (keyId !== PRODUCTION_PROVENANCE_KEY_ID) return null;
  if (keyId === CI_PROVENANCE_KEY_ID || keyId.startsWith("test-")) return null;
  return "external-production";
}

function sameBytes(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function envelopeHasSecret(manifest) {
  for (const entry of manifest?.entries ?? []) {
    const env = entry?.pqcSignatureEnvelope ?? {};
    for (const field of SECRET_MARKERS) {
      if (env[field] != null) return field;
    }
  }
  return null;
}

async function loadLiveProductionSigner(manifest, record) {
  const { createProvenanceKmsSigner } = await import("./kms-provenance.mjs");
  const { signPayload } = await import("./kms-signer.mjs");
  const kms = createProvenanceKmsSigner();
  if (kms.keyId !== PRODUCTION_PROVENANCE_KEY_ID) {
    throw new ExternalSignerError("external signer identity does not match requested production identity");
  }
  const signer = {
    [LIVE_PRODUCTION_SIGNER]: true,
    identity: "production",
    credentialSource: "external-production",
    algorithm: "ML-DSA-87",
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    publicKeyHex: record.publicKey,
    async signMessage(message) {
      const entry = (manifest.entries ?? []).find((candidate) => {
        if (!candidate?.present || !candidate.sha256) return false;
        return sameBytes(canonicalEntrySigningBytes(candidate), message);
      });
      if (!entry) throw new ExternalSignerError("canonical bytes do not match a manifest entry");
      const payload = entrySignPayload(entry);
      if (!sameBytes(canonicalEntrySigningBytes(entry), message)) {
        throw new ExternalSignerError("canonical bytes changed before signing");
      }
      const result = await signPayload(kms, payload);
      if (result?.stub || String(result?.signature ?? "").startsWith("vault-stub-")) {
        throw new ExternalSignerError("stub signature is not a production credential");
      }
      return { signature: result.signature, publicKeyId: result.publicKeyId ?? result.keyId };
    },
  };
  return signer;
}

function finish(details) {
  const rotation = details.rotation;
  const signature = details.signature;
  const decision = details.decision;
  const production = details.production;
  const lines = [
    `production identity: ${PRODUCTION_PROVENANCE_KEY_ID}`,
    ...formatProvenanceStatus(rotation, signature, decision),
    ...formatProductionProvenanceStatus(production),
    `Production provenance E2E: ${details.e2eStatus}`,
  ];
  if (details.signerIdentity) lines.push(`Production signer identity: ${details.signerIdentity}`);
  if (lines.includes("production provenance: VERIFIED") && details.production.productionProvenanceVerified !== true) {
    throw new ExternalSignerError("production provenance VERIFIED requires a live external production signer");
  }
  return {
    exitCode: details.exitCode,
    e2eStatus: details.e2eStatus,
    provisioningState: production.provisioningState,
    productionProvenanceVerified: production.productionProvenanceVerified === true,
    lines,
    manifest: details.manifest,
  };
}

/**
 * @param {object} manifest
 * @param {{ env?: NodeJS.ProcessEnv, lookup?: (id: string) => object | null, signer?: object | null, rotationRegistry?: Map<string, object> | null }} [opts]
 */
export async function runProductionProvenanceE2E(manifest, opts = {}) {
  const env = opts.env ?? process.env;
  const lookup = opts.lookup ?? loadRegistryPublicKey;
  const provisioning = productionSigningKeyStatus(lookup);
  const rotation = classifyRotationEvidence(manifest?.rotationEvidence, opts.rotationRegistry ?? null);
  let signer = opts.signer ?? null;
  const credentialSource = detectProductionCredentialSource(env);

  if (!signer && credentialSource === "external-production" && provisioning.state === PROVISIONING_PROVISIONED) {
    try {
      signer = await loadLiveProductionSigner(manifest, provisioning.record);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failed(manifest, lookup, rotation, provisioning, `production signer unavailable: ${message}`);
    }
  }

  if (provisioning.state === PROVISIONING_INVALID) {
    return failed(manifest, lookup, rotation, provisioning, provisioning.reason);
  }

  if (signer && provisioning.state === PROVISIONING_UNPROVISIONED) {
    signer = null;
  }

  if (signer) {
    try {
      const signed = signer[LIVE_PRODUCTION_SIGNER] === true
        ? await signManifestWithProductionSignerAsync(manifest, signer, { record: provisioning.record })
        : signManifestWithProductionSigner(manifest, signer, { record: provisioning.record });
      const secretField = envelopeHasSecret(signed);
      if (secretField) {
        return failed(signed, lookup, rotation, provisioning, `signature envelope carries ${secretField}`);
      }
      return verifiedOrRejected(signed, lookup, rotation, provisioning, signer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failed(manifest, lookup, rotation, provisioning, message);
    }
  }

  const signature = classifyManifestSignatures(manifest, { resolvePublicKey: lookup });
  const production = assessProductionProvenance(manifest, { signature, lookup });

  if (provisioning.state === PROVISIONING_UNPROVISIONED) {
    const decision = decideProvenanceExit({ signature, rotation, pqcRequired: true, hardErrors: [] });
    return finish({
      manifest,
      rotation,
      signature,
      decision: signature.status === "VERIFIED"
        ? { exitCode: EXIT_PROVENANCE_NOT_VERIFIED, outcome: "NOT_VERIFIED", enforceSignature: true }
        : decision,
      production: {
        ...production,
        productionProvenanceVerified: false,
        productionOutcome: "NOT_PROVISIONED",
      },
      e2eStatus: "NOT RUN",
      exitCode: signature.status === "FAIL" ? EXIT_PROVENANCE_FAIL : EXIT_PROVENANCE_NOT_VERIFIED,
    });
  }

  const decision = {
    exitCode: EXIT_PROVENANCE_NOT_RUN,
    outcome: "NOT_RUN",
    enforceSignature: true,
  };
  return finish({
    manifest,
    rotation,
    signature: signature.status === "FAIL" ? signature : { ...signature, status: "NOT_RUN", reason: "production signer unavailable" },
    decision: signature.status === "FAIL"
      ? { exitCode: EXIT_PROVENANCE_FAIL, outcome: "FAIL", enforceSignature: true }
      : decision,
    production: {
      ...production,
      productionProvenanceVerified: false,
      productionOutcome: signature.status === "FAIL" ? "FAIL" : "NOT_RUN",
    },
    e2eStatus: signature.status === "FAIL" ? "FAIL" : "NOT RUN",
    exitCode: signature.status === "FAIL" ? EXIT_PROVENANCE_FAIL : EXIT_PROVENANCE_NOT_RUN,
  });
}

function failed(manifest, lookup, rotation, provisioning, reason) {
  const signature = {
    status: "FAIL",
    reason,
    unsigned: [],
    signedVerified: [],
    bindingUnavailable: [],
    invalid: [{ artifact: "production-provenance-e2e", error: reason }],
    signerBinding: "checked",
    provenanceVerified: false,
  };
  const production = assessProductionProvenance(manifest, { signature, lookup });
  const outcome = provisioning.state === PROVISIONING_UNPROVISIONED ? "NOT_PROVISIONED" : "FAIL";
  return finish({
    manifest,
    rotation,
    signature,
    decision: { exitCode: EXIT_PROVENANCE_FAIL, outcome: "FAIL", enforceSignature: true },
    production: {
      ...production,
      provisioningState: provisioning.state,
      productionProvenanceVerified: false,
      productionOutcome: outcome === "NOT_PROVISIONED" ? "FAIL" : "FAIL",
    },
    e2eStatus: "FAIL",
    exitCode: EXIT_PROVENANCE_FAIL,
  });
}

function verifiedOrRejected(manifest, lookup, rotation, provisioning, signer) {
  const signature = classifyManifestSignatures(manifest, { resolvePublicKey: lookup });
  const live = signer[LIVE_PRODUCTION_SIGNER] === true;
  const production = assessProductionProvenance(manifest, { signature, lookup });
  const promoted = live && production.productionProvenanceVerified === true && signature.status === "VERIFIED";
  if (signature.status === "FAIL" || signature.status === "NOT_RUN") {
    const decision = decideProvenanceExit({ signature, rotation, pqcRequired: true, hardErrors: [] });
    return finish({
      manifest,
      rotation,
      signature,
      decision,
      production: { ...production, productionProvenanceVerified: false },
      e2eStatus: decision.outcome === "NOT_RUN" ? "NOT RUN" : "FAIL",
      exitCode: decision.exitCode,
      signerIdentity: live ? PRODUCTION_PROVENANCE_KEY_ID : null,
    });
  }
  if (!promoted) {
    return finish({
      manifest,
      rotation,
      signature,
      decision: { exitCode: EXIT_PROVENANCE_NOT_VERIFIED, outcome: "NOT_VERIFIED", enforceSignature: true },
      production: {
        ...production,
        productionProvenanceVerified: false,
        productionOutcome: provisioning.state === PROVISIONING_UNPROVISIONED ? "NOT_PROVISIONED" : "NOT_VERIFIED",
      },
      e2eStatus: "NOT RUN",
      exitCode: EXIT_PROVENANCE_NOT_VERIFIED,
    });
  }
  return finish({
    manifest,
    rotation,
    signature,
    decision: { exitCode: EXIT_PROVENANCE_VERIFIED, outcome: "VERIFIED", enforceSignature: true },
    production,
    e2eStatus: "VERIFIED",
    exitCode: EXIT_PROVENANCE_VERIFIED,
    signerIdentity: PRODUCTION_PROVENANCE_KEY_ID,
  });
}
