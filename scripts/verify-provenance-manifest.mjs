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
} from "./lib/artifact-provenance.mjs";
import { resolveArtifacts } from "./lib/resolve-artifacts.mjs";
import { verifyManifestKmsEntries } from "./lib/kms-provenance.mjs";
import { isExplicitLiveMode } from "./lib/kms-backends/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const live = args.includes("--live");
const pqcRequired = args.includes("--pqc") || args.includes("--require-pqc");
const manifestArg = args.indexOf("--manifest");
const manifestPath =
  manifestArg >= 0 ? path.resolve(args[manifestArg + 1]) : DEFAULT_MANIFEST_PATH;

async function verifyKmsLayer(manifest) {
  const hasKms = (manifest.entries ?? []).some((e) => e.pqcSignatureEnvelope?.kmsBackend);
  if (!hasKms) return { ok: true, errors: [], verifiedCount: 0 };

  const kmsResult = await verifyManifestKmsEntries(manifest);
  if (!kmsResult.ok) {
    return kmsResult;
  }
  return kmsResult;
}

async function main() {
  const t0 = Date.now();

  if (live) {
    const result = verifyLiveArtifacts({ includeOptional: true, pqcRequired });
    console.log(`Provenance live verify — ${result.verifiedCount} artifacts (${result.elapsedMs}ms)`);
    if (pqcRequired) console.log("Mode: strict (--pqc / --require-pqc)");
    for (const w of result.warnings) console.log(`WARN ${w}`);
    if (!result.ok) {
      for (const e of result.errors) console.error(`FAIL ${e}`);
      console.error("\nFAIL artifact provenance check");
      process.exit(1);
    }
    writeManifest(result.manifest, manifestPath);
    console.log(`Updated manifest: ${path.relative(ROOT, manifestPath)}`);
    console.log(`PASS artifact provenance check (${Date.now() - t0}ms overhead)`);
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

  const kmsResult = await verifyKmsLayer(manifest);
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

  if (!result.ok) {
    for (const e of result.errors) console.error(`FAIL ${e}`);
    console.error("\nFAIL artifact provenance check");
    process.exit(1);
  }

  if (liveManifest.resolvedHashes.zkeyHash !== manifest.resolvedHashes?.zkeyHash) {
    console.log("WARN manifest stale — zkey hash differs from live resolution (re-run generate:provenance)");
  }

  console.log(`PASS artifact provenance check (${Date.now() - t0}ms overhead)`);
}

main().catch((err) => {
  console.error(`FAIL ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
