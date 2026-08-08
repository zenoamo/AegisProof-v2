#!/usr/bin/env node
// ============================================================================
// Generate artifact provenance manifest (Phase 8.13 Task 4, Phase 8.14 Task 4 KMS)
// Signs entries via local PQC key (default) or KMS signer when live/OIDC configured.
// Usage: npm run generate:provenance [-- --out artifacts/provenance/manifest.json]
// ============================================================================
import path from "path";
import { fileURLToPath } from "url";
import { resolveArtifacts } from "./lib/resolve-artifacts.mjs";
import {
  DEFAULT_MANIFEST_PATH,
  createManifest,
  writeManifest,
} from "./lib/artifact-provenance.mjs";
import { loadPrivateKey } from "./lib/pqc-signature.mjs";
import {
  shouldUseKmsProvenanceSigning,
  signManifestWithKms,
} from "./lib/kms-provenance.mjs";
import { isExplicitLiveMode } from "./lib/kms-backends/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath = outArg >= 0 ? path.resolve(process.argv[outArg + 1]) : DEFAULT_MANIFEST_PATH;

async function main() {
  const paths = resolveArtifacts();
  let manifest = createManifest(paths, { sign: false });

  if (shouldUseKmsProvenanceSigning()) {
    try {
      manifest = await signManifestWithKms(manifest);
    } catch (err) {
      console.error(`FAIL KMS provenance signing: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  } else {
    manifest = createManifest(paths);
  }

  const written = writeManifest(manifest, outPath);
  const signedCount = manifest.entries.filter((e) => e.pqcSignatureEnvelope?.status === "signed").length;
  const kmsMode = shouldUseKmsProvenanceSigning();

  console.log(`Provenance manifest written: ${path.relative(ROOT, written)}`);
  console.log(`Entries: ${manifest.entries.length} (${signedCount} ML-DSA signed)`);
  console.log(`Signing: ${kmsMode ? "kms" : "local"}`);
  console.log(`Resolver source: ${manifest.resolverSource}`);
  console.log(`zkey hash: ${manifest.resolvedHashes.zkeyHash}`);
  console.log(`vk hash:   ${manifest.resolvedHashes.vkHash}`);

  if (isExplicitLiveMode() && signedCount === 0) {
    console.error("FAIL live mode requires signed provenance entries");
    process.exit(1);
  }

  if (!kmsMode && !loadPrivateKey()) {
    console.log("WARN no PQC private key — entries unsigned (set AEGIS_PQC_PRIVATE_KEY_HEX or run generate-pqc-dev-keys)");
  }
}

main().catch((err) => {
  console.error(`FAIL ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
