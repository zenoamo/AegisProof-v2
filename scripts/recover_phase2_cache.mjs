// ============================================================================
// Post-rollback recovery: rebuild the phase2 cache manifest + vkey WITHOUT
// touching the intact canonical artifacts (r1cs/wasm/sym/ptau/zkey).
// ----------------------------------------------------------------------------
// The suite's FULL mode regenerates the dev setup on cache miss, which would
// replace the hash-pinned ptau/zkey with fresh random ones. To prevent that,
// this script deterministically reconstructs:
//   artifacts/phase2/vkey/vkey_v2.json      (zkey export — deterministic)
//   artifacts/phase2/cache/cache-manifest.json (hashes of existing files)
// and asserts every hash against the pre-rollback hash chain. Any mismatch
// aborts immediately (tamper protection).
// ============================================================================
import { createRequire } from "module";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P2 = path.join(ROOT, "artifacts", "phase2");
const R = (p) => path.join(ROOT, p);
const sha256 = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

// Pre-rollback hash chain (from the Phase 2 cache manifest + E-1 evidence)
const EXPECTED = {
  ssot: "90f7a6a0ee640f7c",
  r1cs: "3d47226b06d707b1",
  wasm: "a0d3c53f3cdce624",
  sym: "3aea81b1778b99c4",
  ptau: "b4f1f3dd3222cdfd",
  zkey: "c80f004e9f6b26fa",
  vkey: "6193351a", // regenerated vkey must hash identically (deterministic export)
};

const PATHS = {
  r1cs: path.join(P2, "r1cs/aegis_commit_core_v2.r1cs"),
  wasm: path.join(P2, "r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm"),
  sym: path.join(P2, "r1cs/aegis_commit_core_v2.sym"),
  ssot: R("specs/aegis-protocol.v2.json"),
  ptau: path.join(P2, "setup/pot10_final.ptau"),
  zkey: path.join(P2, "setup/aegis_v2_0000.zkey"),
  vkey: path.join(P2, "vkey/vkey_v2.json"),
  cache: path.join(P2, "cache/cache-manifest.json"),
};

// --- 1. verify canonical artifacts against the pre-rollback chain ------------
for (const [name, p] of Object.entries(PATHS)) {
  if (name === "vkey" || name === "cache") continue;
  if (!fs.existsSync(p)) {
    console.error(`FATAL: canonical artifact missing: ${p}`);
    process.exit(1);
  }
  const got = sha256(p);
  if (!got.startsWith(EXPECTED[name])) {
    console.error(`FATAL: ${name} hash mismatch — expected ${EXPECTED[name]}…, got ${got}`);
    process.exit(1);
  }
  console.log(`HASH OK  ${name.padEnd(5)} ${got}`);
}

// --- 2. deterministic vkey export -------------------------------------------
const vkeyObj = await snarkjs.zKey.exportVerificationKey(PATHS.zkey);
fs.mkdirSync(path.dirname(PATHS.vkey), { recursive: true });
fs.writeFileSync(PATHS.vkey, JSON.stringify(vkeyObj, null, 2), "utf8");
const vkeyHash = sha256(PATHS.vkey);
if (!vkeyHash.startsWith(EXPECTED.vkey)) {
  console.error(`FATAL: regenerated vkey hash ${vkeyHash} does not match pre-rollback ${EXPECTED.vkey}…`);
  process.exit(1);
}
console.log(`HASH OK  vkey  ${vkeyHash}`);

// --- 3. rebuild cache manifest ----------------------------------------------
fs.mkdirSync(path.dirname(PATHS.cache), { recursive: true });
const cache = {
  protocolVersion: 2,
  setupVersion: "dev-phase2-v1",
  r1csHash: sha256(PATHS.r1cs),
  wasmHash: sha256(PATHS.wasm),
  symHash: sha256(PATHS.sym),
  ssotHash: sha256(PATHS.ssot),
  createdAt: new Date().toISOString(),
  ptauHash: sha256(PATHS.ptau),
  zkeyHash: sha256(PATHS.zkey),
  vkeyHash,
  note: "reconstructed post-rollback from intact canonical artifacts (no regeneration)",
};
fs.writeFileSync(PATHS.cache, JSON.stringify(cache, null, 2), "utf8");
console.log(`WROTE    cache ${path.relative(ROOT, PATHS.cache)}`);
console.log("RECOVERY CACHE REBUILD: OK — canonical artifacts untouched");
process.exit(0);
