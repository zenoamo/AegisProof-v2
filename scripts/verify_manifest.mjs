// ============================================================================
// AegisProof Formal Artifact Manifest Verification (#9)
// ----------------------------------------------------------------------------
// Verifies specs/artifact-manifest.json against the working tree:
//   * Phase 0 artifacts: full SHA-256 match (immutable evidence)
//   * SSoT: full SHA-256 match
//   * Phase 2 artifacts: SHA-256 match against the phase2 cache manifest
//   * Evidence files: exist, mode-correct, check counts as expected
// Exit code 0 = all verified; 1 = any mismatch (never treated as success).
// ============================================================================
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => path.join(ROOT, p);
const sha256 = (p) =>
  fs.existsSync(p) ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") : null;

const manifest = JSON.parse(fs.readFileSync(R("specs/artifact-manifest.json"), "utf8"));
let failures = 0;
const report = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// --- Phase 0 ---------------------------------------------------------------
console.log("== Phase 0 (immutable evidence) ==");
for (const [rel, expected] of Object.entries(manifest.phase0.artifacts)) {
  const got = sha256(R(rel));
  report(got === expected, `phase0:${rel}`, got ? got.slice(0, 16) : "MISSING");
}

// --- SSoT ------------------------------------------------------------------
console.log("== SSoT ==");
const ssotGot = sha256(R(manifest.ssot.path));
report(ssotGot === manifest.ssot.sha256, `ssot:${manifest.ssot.path}`, ssotGot ? ssotGot.slice(0, 16) : "MISSING");

// --- Phase 2 (against cache manifest) ---------------------------------------
console.log("== Phase 2 (dev setup artifacts) ==");
const cache = JSON.parse(fs.readFileSync(R(manifest.phase2.cacheManifest), "utf8"));
for (const key of manifest.phase2.entries) {
  const rel = manifest.phase2.paths[key];
  const got = sha256(R(rel));
  const expected = cache[key];
  report(Boolean(expected) && got === expected, `phase2:${key}`, got ? got.slice(0, 16) : "MISSING");
}

// --- Evidence files (E-1 mode separation) -----------------------------------
console.log("== Evidence (mode-separated) ==");
for (const [mode, rel] of Object.entries({ full: manifest.evidence.full, fast: manifest.evidence.fast })) {
  const p = R(rel);
  if (!fs.existsSync(p)) {
    report(false, `evidence:${mode}`, "MISSING");
    continue;
  }
  const e = JSON.parse(fs.readFileSync(p, "utf8"));
  const n = Object.keys(e.checks).length;
  const failed = Object.values(e.checks).filter((c) => !c.pass).length;
  const expectedN = mode === "full" ? manifest.evidence.fullExpectedChecks : manifest.evidence.fastExpectedChecks;
  report(
    e.mode === mode.toUpperCase() && n === expectedN && failed === 0,
    `evidence:${mode}`,
    `mode=${e.mode} checks=${n}/${expectedN} failed=${failed}`
  );
}

// --- Phase 4 (production trusted setup, present only after the ceremony) -----
if (manifest.phase4) {
  console.log("== Phase 4 (production trusted setup) ==");
  for (const key of Object.keys(manifest.phase4.finalHashes)) {
    const rel = manifest.phase4.paths[key];
    const got = sha256(R(rel));
    report(got === manifest.phase4.finalHashes[key], `phase4:${key}`, got ? got.slice(0, 16) : "MISSING");
  }
  // ceremony records must exist (transcript, per-step hashes, beacon record)
  const recs = [
    "artifacts/phase4/transcripts/ceremony-transcript.log",
    "artifacts/phase4/hashes/hashes.json",
    "artifacts/phase4/beacon/beacon-record.json",
    "artifacts/phase4/ceremony/ceremony-metadata.json",
  ];
  for (const rel of recs) report(fs.existsSync(R(rel)), `phase4:record:${path.basename(rel)}`);
  // dev/production separation: no phase4 final hash may match a dev hash
  const DEV = ["c80f004e9f6b26fa", "b4f1f3dd3222cdfd", "6193351af0892493"];
  const mixed = Object.values(manifest.phase4.finalHashes).some((h) => DEV.some((d) => h.startsWith(d)));
  report(!mixed, "phase4:dev-separation", mixed ? "DEV HASH PROMOTED TO PRODUCTION" : "production hashes distinct from dev setup");
}

console.log(failures === 0 ? "MANIFEST VERIFICATION: PASS" : `MANIFEST VERIFICATION: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
