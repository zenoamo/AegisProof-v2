#!/usr/bin/env node
// ============================================================================
// Verify artifact provenance manifest (Phase 8.13 Task 5, Phase 8.14 Task 4 KMS)
// Usage:
//   npm run verify:provenance [-- --live] [-- --manifest path] [-- --pqc]
//   --live: regenerate manifest from resolveArtifacts() and verify (CI default)
//   --pqc / --require-pqc: ML-DSA signature required (strict / production simulation)
// ============================================================================
import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_MANIFEST_PATH,
  loadManifest,
  verifyLiveArtifacts,
  verifyManifest,
  createManifest,
  writeManifest,
  preserveVerifiedKmsEnvelopes,
} from "./lib/artifact-provenance.mjs";
import { resolveArtifacts } from "./lib/resolve-artifacts.mjs";
import { verifyManifestKmsLayer } from "./lib/kms-provenance.mjs";
import { isExplicitLiveMode } from "./lib/kms-backends/env.mjs";
import {
  classifyManifestSignatures,
  classifyRotationEvidence,
  decideProvenanceExit,
  formatProvenanceStatus,
  isPqcAbsenceError,
} from "./lib/provenance-verification-status.mjs";

function reportProvenance(manifest, errors, pqcRequired) {
  const signature = classifyManifestSignatures(manifest);
  const rotation = classifyRotationEvidence(manifest?.rotationEvidence);
  const hardErrors = (errors ?? []).filter((error) => !isPqcAbsenceError(error));
  const decision = decideProvenanceExit({ signature, rotation, pqcRequired, hardErrors });
  const lines = formatProvenanceStatus(rotation, signature, decision);
  const sink = decision.exitCode === 0 ? console.log : console.error;
  for (const line of lines) sink(line);
  for (const error of hardErrors) console.error(`FAIL ${error}`);
  if (decision.exitCode !== 0) process.exit(decision.exitCode);
  return decision;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const live = args.includes("--live");
const pqcRequired = args.includes("--pqc") || args.includes("--require-pqc");
const allowMissingProductionZkey = args.includes("--allow-missing-production-zkey");
const manifestArg = args.indexOf("--manifest");
const manifestPath =
  manifestArg >= 0 ? path.resolve(args[manifestArg + 1]) : DEFAULT_MANIFEST_PATH;

async function main() {
  const t0 = Date.now();

  if (live) {
    const result = verifyLiveArtifacts({ includeOptional: true, pqcRequired, allowMissingProductionZkey });
    console.log(`Provenance live verify — ${result.verifiedCount} artifacts (${result.elapsedMs}ms)`);
    if (pqcRequired) console.log("Mode: strict (--pqc / --require-pqc)");
    for (const w of result.warnings) console.log(`WARN ${w}`);
    reportProvenance(result.manifest, result.errors, pqcRequired);

    let committedManifest = null;
    try {
      committedManifest = loadManifest(manifestPath);
    } catch {
      // No committed manifest yet — hash-only gate applies until first write.
    }

    if (committedManifest) {
      const kmsResult = await verifyManifestKmsLayer(committedManifest);
      if (!kmsResult.ok) {
        for (const e of kmsResult.errors) console.error(`FAIL ${e}`);
        console.error("\nFAIL artifact provenance check (committed manifest KMS layer)");
        process.exit(1);
      }
      if (kmsResult.verifiedCount > 0) {
        console.log(`KMS verify: ${kmsResult.verifiedCount} entries (committed manifest)`);
      }
    }

    const manifestToWrite = committedManifest
      ? preserveVerifiedKmsEnvelopes(result.manifest, committedManifest)
      : result.manifest;

    writeManifest(manifestToWrite, manifestPath);
    console.log(`Updated manifest: ${path.relative(ROOT, manifestPath)}`);
    console.log(`PASS classical artifact hash check (${Date.now() - t0}ms overhead)`);
    process.exit(0);
  }

  let manifest;
  try {
    manifest = loadManifest(manifestPath);
  } catch {
    console.error(`FAIL manifest not found: ${manifestPath} (use --live to generate)`);
    process.exit(1);
  }

  const paths = resolveArtifacts();
  const liveManifest = createManifest(paths);
  const result = verifyManifest(manifest, {
    allowMissingOptional: true,
    pqcRequired: pqcRequired && !(manifest.entries ?? []).some((e) => e.pqcSignatureEnvelope?.kmsBackend),
  });

  console.log(`Provenance manifest verify — file: ${path.relative(ROOT, manifestPath)}`);
  if (pqcRequired) console.log("Mode: --pqc (ML-DSA required)");

  const kmsResult = await verifyManifestKmsLayer(manifest);
  if (!kmsResult.ok) {
    for (const e of kmsResult.errors) result.errors.push(e);
    result.ok = false;
  } else if (kmsResult.verifiedCount > 0) {
    console.log(`KMS verify: ${kmsResult.verifiedCount} entries`);
  }

  if (pqcRequired && isExplicitLiveMode() && kmsResult.verifiedCount === 0 &&
      (manifest.entries ?? []).some((e) => e.pqcSignatureEnvelope?.kmsBackend)) {
    result.errors.push("live KMS verification produced zero verified entries");
    result.ok = false;
  }

  for (const w of result.warnings) console.log(`WARN ${w}`);

  reportProvenance(manifest, result.errors, pqcRequired);

  if (liveManifest.resolvedHashes.zkeyHash !== manifest.resolvedHashes?.zkeyHash) {
    console.log("WARN manifest stale — zkey hash differs from live resolution (re-run generate:provenance)");
  }

  console.log(`PASS classical artifact hash check (${Date.now() - t0}ms overhead)`);
}

main().catch((err) => {
  console.error(`FAIL ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
