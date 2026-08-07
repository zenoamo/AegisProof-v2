#!/usr/bin/env node
// ============================================================================
// Generate artifact provenance manifest (Phase 8.13 Task 4)
// Signs entries when AEGIS_PQC_PRIVATE_KEY_HEX or local dev key is present.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath = outArg >= 0 ? path.resolve(process.argv[outArg + 1]) : DEFAULT_MANIFEST_PATH;

const paths = resolveArtifacts();
const manifest = createManifest(paths);
const written = writeManifest(manifest, outPath);

const key = loadPrivateKey();
const signedCount = manifest.entries.filter((e) => e.pqcSignatureEnvelope?.status === "signed").length;

console.log(`Provenance manifest written: ${path.relative(ROOT, written)}`);
console.log(`Entries: ${manifest.entries.length} (${signedCount} ML-DSA signed)`);
console.log(`Resolver source: ${manifest.resolverSource}`);
console.log(`zkey hash: ${manifest.resolvedHashes.zkeyHash}`);
console.log(`vk hash:   ${manifest.resolvedHashes.vkHash}`);
if (!key) {
  console.log("WARN no PQC private key — entries unsigned (set AEGIS_PQC_PRIVATE_KEY_HEX or run generate-pqc-dev-keys)");
}
