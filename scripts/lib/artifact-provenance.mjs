// ============================================================================
// Artifact provenance layer (Phase 8.13 Task 5 — PQC CI hardening)
// ----------------------------------------------------------------------------
// Verification order: 1) manifest integrity  2) artifact hash  3) PQC signature
// ============================================================================
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  PRODUCTION_VKEY_HASH,
  PRODUCTION_ZKEY_HASH,
  ROOT,
  artifactHashes,
  resolveArtifacts,
  sha256File,
  sha256VkeyCeremony,
} from "./resolve-artifacts.mjs";
import { resolveRapidsnarkBin } from "./provers.mjs";
import {
  PQC_ALGORITHM_VERSION,
  PQC_ENVELOPE_PLACEHOLDER,
  PQC_ENVELOPE_UNSIGNED,
  PQC_VERSION,
  bytesToHex,
  createPqcSignatureEnvelope,
  entrySignPayload,
  loadPrivateKey,
  verifyEnvelope,
  verifyPqcSignatureEnvelope,
} from "./pqc-signature.mjs";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";

export const PROVENANCE_SCHEMA_VERSION = 1;
export const PROVENANCE_PHASE = "8.13";
export const DEFAULT_MANIFEST_PATH = path.join(ROOT, "artifacts", "provenance", "manifest.json");
export const DEFAULT_CI_KEY_ID = "aegis-ci-mldsa87-v1";

export { PQC_ENVELOPE_PLACEHOLDER, PQC_ENVELOPE_UNSIGNED };

/**
 * @param {string} absPath
 * @param {string} [source]
 */
export function fileEntry(absPath, artifactName, source, version = "v2") {
  if (!fs.existsSync(absPath)) {
    return {
      artifact: artifactName,
      path: path.relative(ROOT, absPath),
      sha256: null,
      size: null,
      createdAt: null,
      source: source ?? "missing",
      version,
      present: false,
      classicalHash: { algorithm: "SHA-256", digest: null },
      pqcSignatureEnvelope: { ...PQC_ENVELOPE_UNSIGNED },
    };
  }
  const stat = fs.statSync(absPath);
  const digest = sha256File(absPath);
  return {
    artifact: artifactName,
    path: path.relative(ROOT, absPath).split(path.sep).join("/"),
    sha256: digest,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
    source: source ?? "unknown",
    version,
    present: true,
    classicalHash: { algorithm: "SHA-256", digest },
    pqcSignatureEnvelope: { ...PQC_ENVELOPE_UNSIGNED },
  };
}

function gitCommit() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: ROOT });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function resolvePublicKeyHex(keyMaterial) {
  if (keyMaterial.publicKeyHex) return keyMaterial.publicKeyHex;
  return bytesToHex(ml_dsa87.getPublicKey(keyMaterial.secretKey));
}

/**
 * Sign a single manifest entry when private key is available.
 * @param {object} entry
 * @param {{ secretKey: Uint8Array, publicKeyHex?: string, publicKeyId?: string }} keyMaterial
 */
export function signEntry(entry, keyMaterial) {
  if (!entry.present || !entry.sha256) {
    return entry;
  }
  const payload = entrySignPayload(entry);
  const envelope = createPqcSignatureEnvelope(payload, {
    privateKey: keyMaterial.secretKey,
    publicKeyHex: resolvePublicKeyHex(keyMaterial),
    publicKeyId: keyMaterial.publicKeyId ?? keyMaterial.keyId ?? null,
  });
  return { ...entry, pqcSignatureEnvelope: envelope };
}

/**
 * Sign all present entries in manifest.
 * @param {object} manifest
 * @param {{ secretKey?: Uint8Array, publicKeyHex?: string, publicKeyId?: string }} [keyMaterial]
 */
export function signManifest(manifest, keyMaterial) {
  const keys = keyMaterial ?? loadPrivateKey();
  if (!keys) {
    return manifest;
  }
  const publicKeyHex = resolvePublicKeyHex(keys);
  const entries = manifest.entries.map((e) =>
    signEntry(e, { secretKey: keys.secretKey, publicKeyHex, publicKeyId: keys.publicKeyId })
  );
  return {
    ...manifest,
    entries,
    pqcPolicy: {
      ...manifest.pqcPolicy,
      pqcSignatureRequired: false,
      signingKeyId: keys.publicKeyId,
      signedAt: new Date().toISOString(),
    },
  };
}

/**
 * Build provenance manifest from resolved artifact paths.
 * @param {ReturnType<typeof resolveArtifacts>} [paths]
 * @param {{ includeOptional?: boolean, sign?: boolean }} [opts]
 */
export function createManifest(paths = resolveArtifacts(), opts = {}) {
  const includeOptional = opts.includeOptional !== false;
  const hashes = artifactHashes(paths);
  const entries = [];

  const core = [
    ["production.zkey", paths.zkey, paths.sources?.zkey],
    ["production-vkey.json", paths.vkey, paths.sources?.vkey],
    ["aegis_commit_core_v2.wasm", paths.wasm, paths.sources?.wasm],
    ["aegis_commit_core_v2.r1cs", paths.r1cs, paths.sources?.r1cs],
  ];

  for (const [name, abs, source] of core) {
    entries.push(fileEntry(abs, name, source));
  }

  if (includeOptional) {
    const rapidsnarkBin = resolveRapidsnarkBin();
    if (rapidsnarkBin) {
      entries.push(fileEntry(rapidsnarkBin, "rapidsnark-prover", "local-build", "rapidsnark-host"));
    }

    const benchPaths = [
      path.join(ROOT, "benchmarks", "reports", "baseline.json"),
      path.join(ROOT, "benchmarks", "reports", "rapidsnark-evaluation.json"),
    ];
    for (const bp of benchPaths) {
      if (fs.existsSync(bp)) {
        entries.push(fileEntry(bp, path.basename(bp), "benchmarks/reports", "8.11"));
      }
    }
  }

  const manifest = {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    phase: PROVENANCE_PHASE,
    generatedAt: new Date().toISOString(),
    commit: gitCommit(),
    profile: paths.profile ?? "prover",
    resolverSource: paths.sources?.wasm ?? "unknown",
    pinnedProductionHashes: {
      zkeyHash: PRODUCTION_ZKEY_HASH,
      vkHash: PRODUCTION_VKEY_HASH,
    },
    resolvedHashes: hashes,
    entries,
    pqcPolicy: {
      classicalRequired: true,
      pqcSignatureRequired: false,
      allowedPqcAlgorithms: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      algorithmVersion: PQC_ALGORITHM_VERSION,
      version: PQC_VERSION,
    },
  };

  if (opts.sign !== false) {
    return signManifest(manifest);
  }
  return manifest;
}

/**
 * Verify PQC signature on a single entry.
 * @param {object} entry
 */
export function verifyEntryPqc(entry) {
  const env = entry.pqcSignatureEnvelope;
  if (!env || env.status !== "signed") {
    return { ok: false, error: env?.status === "placeholder" ? "legacy placeholder" : "unsigned" };
  }
  if (!env.signature) {
    return { ok: false, error: "signature missing" };
  }
  const payload = entrySignPayload(entry);
  return verifyEnvelope(payload, env);
}

/**
 * Manifest structural integrity (step 2 — before PQC, after schema).
 * @param {object} manifest
 */
export function verifyManifestIntegrity(manifest) {
  const errors = [];

  if (manifest.schemaVersion !== PROVENANCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion mismatch: expected ${PROVENANCE_SCHEMA_VERSION}, got ${manifest.schemaVersion}`);
  }

  if (!manifest.pinnedProductionHashes?.zkeyHash) {
    errors.push("pinnedProductionHashes.zkeyHash missing");
  } else if (manifest.pinnedProductionHashes.zkeyHash !== PRODUCTION_ZKEY_HASH) {
    errors.push("pinnedProductionHashes.zkeyHash != production constant");
  }

  if (!manifest.pinnedProductionHashes?.vkHash) {
    errors.push("pinnedProductionHashes.vkHash missing");
  } else if (manifest.pinnedProductionHashes.vkHash !== PRODUCTION_VKEY_HASH) {
    errors.push("pinnedProductionHashes.vkHash != production constant");
  }

  if (manifest.resolvedHashes?.zkeyHash && manifest.resolvedHashes.zkeyHash !== PRODUCTION_ZKEY_HASH) {
    errors.push("resolvedHashes.zkeyHash != pinned production zkey");
  }

  const seen = new Set();
  for (const entry of manifest.entries ?? []) {
    if (seen.has(entry.artifact)) {
      errors.push(`duplicate manifest entry: ${entry.artifact}`);
    }
    seen.add(entry.artifact);

    if (entry.classicalHash?.digest && entry.sha256 && entry.classicalHash.digest !== entry.sha256) {
      errors.push(`classicalHash digest != sha256: ${entry.artifact}`);
    }

    if (entry.sha256 && entry.classicalHash?.algorithm !== "SHA-256") {
      errors.push(`classicalHash algorithm must be SHA-256: ${entry.artifact}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Verify manifest against filesystem and pinned production hashes.
 * Order: integrity → artifact hash → PQC signature
 * @param {object} manifest
 * @param {{ requirePqcSignature?: boolean, pqcRequired?: boolean, allowMissingOptional?: boolean, requireRegistry?: boolean, maxSignatureAgeMs?: number }} [opts]
 */
export function verifyManifest(manifest, opts = {}) {
  const errors = [];
  const warnings = [];
  const verified = [];

  const pqcRequired = opts.pqcRequired ?? opts.requirePqcSignature ?? false;

  const integrity = verifyManifestIntegrity(manifest);
  if (!integrity.ok) {
    errors.push(...integrity.errors);
  }

  const requiredArtifacts = new Set([
    "production.zkey",
    "production-vkey.json",
    "aegis_commit_core_v2.wasm",
    "aegis_commit_core_v2.r1cs",
  ]);

  const seen = new Set();

  for (const entry of manifest.entries ?? []) {
    seen.add(entry.artifact);
    const abs = path.join(ROOT, entry.path.replace(/\//g, path.sep));

    if (requiredArtifacts.has(entry.artifact) && !entry.present && !fs.existsSync(abs)) {
      errors.push(`missing required artifact: ${entry.artifact} (${entry.path})`);
      continue;
    }

    if (!fs.existsSync(abs)) {
      if (opts.allowMissingOptional || !requiredArtifacts.has(entry.artifact)) {
        warnings.push(`optional artifact absent: ${entry.artifact}`);
      }
      continue;
    }

    const liveHash = sha256File(abs);
    if (liveHash !== entry.sha256) {
      errors.push(`hash mismatch: ${entry.artifact} manifest=${entry.sha256?.slice(0, 16)} live=${liveHash.slice(0, 16)}`);
      continue;
    }

    if (entry.artifact === "production.zkey" && liveHash !== PRODUCTION_ZKEY_HASH) {
      errors.push(`production.zkey hash != pinned constant`);
    }
    if (entry.artifact === "production-vkey.json") {
      const vkCeremony = sha256VkeyCeremony(abs);
      if (vkCeremony !== PRODUCTION_VKEY_HASH) {
        errors.push(`production vkey ceremony hash != pinned constant`);
      }
    }

    verified.push(entry.artifact);
  }

  for (const name of requiredArtifacts) {
    if (!seen.has(name)) {
      errors.push(`unexpected missing manifest entry: ${name}`);
    }
  }

  // Step 3: PQC signature layer — additive; runs after hash verification
  const pqcResult = verifyPqcSignatureEnvelope(manifest, {
    required: pqcRequired,
    requiredArtifacts,
    requireRegistry: opts.requireRegistry,
    maxSignatureAgeMs: opts.maxSignatureAgeMs,
  });
  for (const w of pqcResult.warnings) warnings.push(w);
  for (const e of pqcResult.errors) errors.push(e);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    verified,
    verifiedCount: verified.length,
    pqc: pqcResult,
  };
}

export function writeManifest(manifest, outPath = DEFAULT_MANIFEST_PATH) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");
  return outPath;
}

export function loadManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

/**
 * Whether an envelope carries a KMS-signed provenance layer worth preserving.
 * @param {object | null | undefined} env
 */
export function isPreservableKmsEnvelope(env) {
  return Boolean(
    env?.kmsBackend &&
      env.status === "signed" &&
      typeof env.signature === "string" &&
      env.signature.length > 0
  );
}

/**
 * After --live regeneration, copy KMS envelopes from the committed manifest onto
 * regenerated entries only when artifact identity (name + sha256) is unchanged.
 * Prevents cross-artifact signature reuse and drops envelopes when content changed.
 * @param {object} regenerated
 * @param {object} committed
 */
export function preserveVerifiedKmsEnvelopes(regenerated, committed) {
  const committedByArtifact = new Map((committed.entries ?? []).map((e) => [e.artifact, e]));
  let preservedCount = 0;

  const entries = (regenerated.entries ?? []).map((entry) => {
    const prev = committedByArtifact.get(entry.artifact);
    const env = prev?.pqcSignatureEnvelope;
    if (!isPreservableKmsEnvelope(env)) {
      return entry;
    }
    if (!prev.sha256 || !entry.sha256 || prev.sha256 !== entry.sha256) {
      return entry;
    }
    preservedCount++;
    return {
      ...entry,
      pqcSignatureEnvelope: structuredClone(env),
    };
  });

  const out = { ...regenerated, entries };
  if (preservedCount > 0 && committed.pqcPolicy) {
    out.pqcPolicy = {
      ...out.pqcPolicy,
      ...(committed.pqcPolicy.signingKeyId ? { signingKeyId: committed.pqcPolicy.signingKeyId } : {}),
      ...(committed.pqcPolicy.signingBackend ? { signingBackend: committed.pqcPolicy.signingBackend } : {}),
      ...(committed.pqcPolicy.kmsLive != null ? { kmsLive: committed.pqcPolicy.kmsLive } : {}),
    };
  }
  return out;
}

/**
 * End-to-end: resolve → create → verify (measures overhead).
 */
export function verifyLiveArtifacts(opts = {}) {
  const t0 = Date.now();
  const paths = resolveArtifacts(opts.profile ? { profile: opts.profile } : {});
  const manifest = createManifest(paths, { includeOptional: opts.includeOptional });
  const pqcRequired = opts.pqcRequired ?? opts.requirePqcSignature ?? false;
  const result = verifyManifest(manifest, {
    allowMissingOptional: true,
    pqcRequired,
  });
  result.elapsedMs = Date.now() - t0;
  result.manifest = manifest;
  return result;
}
