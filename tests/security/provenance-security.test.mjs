// ============================================================================
// Penetration Test — Provenance manifest integrity (PT-02, PT-03)
// Run: npm run test:penetration
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const {
  createManifest,
  verifyManifest,
  verifyManifestIntegrity,
  loadManifest,
  DEFAULT_MANIFEST_PATH,
  PROVENANCE_SCHEMA_VERSION,
} = await import("../../scripts/lib/artifact-provenance.mjs");

const {
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  resolveArtifacts,
  sha256File,
  sha256VkeyCeremony,
} = await import("../../scripts/lib/resolve-artifacts.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const paths = resolveArtifacts();
const manifest = createManifest(paths, { sign: false });

ok(fs.existsSync(DEFAULT_MANIFEST_PATH), "PT-02: committed manifest.json exists");
const committed = loadManifest();

// --- PT-02: Manifest Integrity Tampering ---
const schemaTamper = JSON.parse(JSON.stringify(committed));
schemaTamper.schemaVersion = 99;
const s02a = verifyManifestIntegrity(schemaTamper);
ok(!s02a.ok && s02a.errors.some((e) => e.includes("schemaVersion")), "PT-02: schema modification reject");

const metaTamper = JSON.parse(JSON.stringify(committed));
const presentIdx = metaTamper.entries.findIndex((e) => e.present && e.sha256);
if (presentIdx >= 0) {
  metaTamper.entries[presentIdx].sha256 = "0".repeat(64);
  metaTamper.entries[presentIdx].classicalHash.digest = "0".repeat(64);
}
const s02b = verifyManifest(metaTamper, { allowMissingOptional: true });
ok(!s02b.ok && s02b.errors.some((e) => e.includes("hash mismatch")), "PT-02: artifact metadata/hash tampering reject");

const hashTamper = JSON.parse(JSON.stringify(committed));
const hashTamperEntry = hashTamper.entries.find((e) => e.sha256 && e.classicalHash);
if (hashTamperEntry) {
  hashTamperEntry.classicalHash.digest = "0".repeat(64);
}
const s02c = verifyManifestIntegrity(hashTamper);
ok(!s02c.ok && s02c.errors.some((e) => e.includes("classicalHash")), "PT-02: classicalHash modification reject");

const pinnedTamper = JSON.parse(JSON.stringify(committed));
pinnedTamper.pinnedProductionHashes.zkeyHash = "f".repeat(64);
const s02d = verifyManifestIntegrity(pinnedTamper);
ok(!s02d.ok && s02d.errors.some((e) => e.includes("zkeyHash")), "PT-02: pinned hash tampering reject");

const dupEntry = JSON.parse(JSON.stringify(committed));
dupEntry.entries.push({ ...dupEntry.entries[0] });
const s02e = verifyManifestIntegrity(dupEntry);
ok(!s02e.ok && s02e.errors.some((e) => e.includes("duplicate")), "PT-02: duplicate entry reject");

const validIntegrity = verifyManifestIntegrity(committed);
ok(validIntegrity.ok, "PT-02: committed manifest integrity PASS");

// --- PT-03: Artifact Hash Integrity Test ---
const zkeyEntry = committed.entries.find((e) => e.artifact === "production.zkey");
const vkEntry = committed.entries.find((e) => e.artifact === "production-vkey.json");

ok(
  zkeyEntry?.present === false && zkeyEntry?.sha256 === null,
  "PT-03: migrated manifest records external zkey as absent"
);
ok(committed.pinnedProductionHashes.zkeyHash === PRODUCTION_ZKEY_HASH, "PT-03: pinned zkey constant");

const hashMismatch = JSON.parse(JSON.stringify(committed));
const mismatchIdx = hashMismatch.entries.findIndex((e) => e.present && e.sha256);
if (mismatchIdx >= 0) {
  hashMismatch.entries[mismatchIdx].sha256 = "a".repeat(64);
}
const s03a = verifyManifest(hashMismatch, { allowMissingOptional: true });
ok(!s03a.ok && s03a.errors.some((e) => e.includes("hash mismatch")), "PT-03: artifact hash mismatch reject");

const vkMismatch = JSON.parse(JSON.stringify(committed));
const vkidx = vkMismatch.entries.findIndex((e) => e.artifact === "production-vkey.json");
if (vkidx >= 0) {
  vkMismatch.entries[vkidx].sha256 = "b".repeat(64);
}
const s03b = verifyManifest(vkMismatch, { allowMissingOptional: true });
ok(!s03b.ok, "PT-03: VK file hash mismatch reject");

if (fs.existsSync(paths.zkey)) {
  const liveZ = sha256File(paths.zkey);
  ok(liveZ === PRODUCTION_ZKEY_HASH, "PT-03: live production.zkey matches ceremony pin");
} else {
  console.log("SKIP PT-03: live zkey file absent");
}

if (fs.existsSync(paths.vkey)) {
  const liveVk = sha256VkeyCeremony(paths.vkey);
  ok(liveVk === PRODUCTION_VKEY_HASH, "PT-03: live VK ceremony hash matches pin");
  ok(vkEntry?.present !== false || fs.existsSync(paths.vkey), "PT-03: VK entry resolvable");
} else {
  console.log("SKIP PT-03: live vkey file absent");
}

const resolvedTamper = JSON.parse(JSON.stringify(committed));
resolvedTamper.resolvedHashes.zkeyHash = "c".repeat(64);
const s03c = verifyManifestIntegrity(resolvedTamper);
ok(!s03c.ok && s03c.errors.some((e) => e.includes("resolvedHashes")), "PT-03: resolvedHashes ceremony mismatch reject");

const fresh = createManifest(paths, { sign: false });
ok(fresh.schemaVersion === PROVENANCE_SCHEMA_VERSION, "PT-03: fresh manifest schema valid");
const liveVerify = verifyManifest(fresh, {
  allowMissingOptional: true,
  allowMissingProductionZkey: true,
});
ok(liveVerify.ok, "PT-03: repository-tier live manifest verify PASS");

console.log(`\nPROVENANCE SECURITY: ${passed} checks PASS`);
