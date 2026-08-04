// ============================================================================
// PHASE 4 PRODUCTION TRUSTED SETUP — MULTI-CONTRIBUTOR CEREMONY + BEACON
// ----------------------------------------------------------------------------
// AUTHORIZATION: Phase 4 items 1-5 AUTHORIZED (human). Conditions enforced:
//   * canonical verified R1CS only (hash pre-flight against cache manifest)
//   * dev zkey/vkey NEVER promoted (dev hashes asserted absent from outputs)
//   * everything persisted under artifacts/phase4/ (disjoint namespace)
//   * Phase 0-3 artifacts immutable (pre-flight hash check; writes only to P4)
//   * ANY abort condition => immediate stop, failure never treated as success
//
// Ceremony structure:
//   Powers-of-Tau: new(2^14) -> 3 contributions -> beacon -> preparePhase2
//   Groth16 zkey:  new(canonical R1CS + ceremony ptau) -> 3 contributions
//                  -> beacon -> final production.zkey -> production vkey
//
// Beacon: Bitcoin GENESIS BLOCK HASH (public, immutable, independently
// checkable) with 2^10 hash iterations, applied to BOTH chains.
//
// CONTRIBUTOR DISCLOSURE: the 3 contribution slots per chain are executed by
// this orchestration script in a single environment, each with fresh
// crypto.randomBytes entropy that is discarded immediately after use (never
// persisted). Structurally this is a multi-contribution chain, but it does
// NOT provide the trust distribution of independent human contributors; the
// final zkey remains open to FURTHER contributions before a mainnet-grade
// deployment decision (see docs/phase4-ceremony-report.md).
// ============================================================================
import { createRequire } from "module";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => path.join(ROOT, p);
const P4 = path.join(ROOT, "artifacts", "phase4");
const D = {
  ceremony: path.join(P4, "ceremony"),
  contributions: path.join(P4, "contributions"),
  transcripts: path.join(P4, "transcripts"),
  hashes: path.join(P4, "hashes"),
  beacon: path.join(P4, "beacon"),
  final: path.join(P4, "final"),
  reports: path.join(P4, "reports"),
};

const R1CS = R("artifacts/phase2/r1cs/aegis_commit_core_v2.r1cs");
const SSOT = R("specs/aegis-protocol.v2.json");
const ART_MANIFEST = R("specs/artifact-manifest.json");
const CACHE_MANIFEST = R("artifacts/phase2/cache/cache-manifest.json");

const POT_POWER = 14; // 2*6590 constraints = 13180 domain points -> 2^14
const N_CONTRIBUTORS = 3;
const BEACON_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"; // Bitcoin genesis block hash
const BEACON_ITER_EXP = 10; // 2^10 hash iterations per snarkjs beacon spec
const DEV_HASHES = {
  devZkey: "c80f004e9f6b26fa",
  devPtau: "b4f1f3dd3222cdfd",
  devVkey: "6193351af0892493",
};

// --- logging / abort ---------------------------------------------------------
const t0 = Date.now();
const logLines = [];
function log(m) {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  logLines.push(line);
}
function flushTranscript(name) {
  fs.writeFileSync(path.join(D.transcripts, name), logLines.join("\n") + "\n", "utf8");
}
function abort(m) {
  log(`*** ABORT: ${m} — ceremony stopped, failure NOT treated as success ***`);
  try {
    fs.mkdirSync(D.transcripts, { recursive: true });
    flushTranscript("ABORT.txt");
  } catch {}
  process.exit(1);
}
async function strict(step, fn) {
  try {
    return await fn();
  } catch (e) {
    abort(`${step}: ${e.message}`);
  }
}
function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}
const hashRecord = { ceremony: "phase4-production", steps: [] };
function recordHash(step, file) {
  const h = sha256File(file);
  hashRecord.steps.push({ step, file: path.relative(ROOT, file), sha256: h, sizeBytes: fs.statSync(file).size });
  log(`HASH ${step}: ${h} (${path.basename(file)})`);
  return h;
}

// --- PRE-FLIGHT (read-only) ---------------------------------------------------
if (fs.existsSync(P4)) abort("artifacts/phase4/ already exists — refusing to overwrite a prior ceremony");
for (const dir of Object.values(D)) fs.mkdirSync(dir, { recursive: true });

log("PHASE 4 PRODUCTION TRUSTED SETUP — ceremony starting");
log(`canonical R1CS: ${path.relative(ROOT, R1CS)}`);

// Phase 0 immutability pre-flight
const artManifest = JSON.parse(fs.readFileSync(ART_MANIFEST, "utf8"));
for (const [rel, expected] of Object.entries(artManifest.phase0.artifacts)) {
  const h = sha256File(R(rel));
  if (h !== expected) abort(`Phase 0 hash mismatch: ${rel}`);
}
log(`PASS Phase 0 pre-flight: ${Object.keys(artManifest.phase0.artifacts).length}/10 hashes match`);

// SSoT pre-flight
if (sha256File(SSOT) !== artManifest.ssot.sha256) abort("SSoT hash mismatch");
log("PASS SSoT pre-flight: hash matches manifest");

// canonical R1CS must match the pinned cache-manifest hash
const cache = JSON.parse(fs.readFileSync(CACHE_MANIFEST, "utf8"));
const r1csHash = sha256File(R1CS);
if (r1csHash !== cache.r1csHash) abort(`R1CS hash mismatch: ${r1csHash}`);
if (sha256File(SSOT) !== cache.ssotHash) abort("SSoT hash mismatch vs cache manifest");
log(`PASS canonical R1CS verified: ${r1csHash}`);

// ceremony metadata
const gitHead = (() => {
  try {
    return require("child_process").execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();
  } catch {
    return "unavailable";
  }
})();
const metadata = {
  ceremony: "AegisProof v2 production trusted setup",
  protocol: "groth16",
  curve: "bn128",
  r1cs: { path: "artifacts/phase2/r1cs/aegis_commit_core_v2.r1cs", sha256: r1csHash },
  ssotSha256: artManifest.ssot.sha256,
  potPower: POT_POWER,
  nConstraints: 6590,
  nPublic: 30,
  contributorsPerChain: N_CONTRIBUTORS,
  contributorPolicy:
    "orchestrated slots with fresh crypto.randomBytes entropy discarded after each contribution; NOT independent human contributors — see report disclosure",
  beacon: { source: "Bitcoin genesis block hash", hash: BEACON_HASH, iterationsExp: BEACON_ITER_EXP },
  startedAt: new Date().toISOString(),
  gitHead,
  snarkjsVersion: JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/snarkjs/package.json"), "utf8")).version,
  devArtifactsForbidden: DEV_HASHES,
};

// --- POWERS OF TAU CHAIN -------------------------------------------------------
log(`--- POWERS OF TAU (2^${POT_POWER}) ---`);
const curve = await strict("curves", () => snarkjs.curves.getCurveFromName("bn128"));
const potFiles = [];
const potInit = path.join(D.contributions, "pot_0000_init.ptau");
await strict("pot new", () => snarkjs.powersOfTau.newAccumulator(curve, POT_POWER, potInit, silent));
potFiles.push(potInit);
recordHash("pot:0000:init", potInit);

for (let i = 1; i <= N_CONTRIBUTORS; i++) {
  const id = `phase4-pot-contributor-${i}`;
  const out = path.join(D.contributions, `pot_000${i}_${id}.ptau`);
  await strict(`pot contribute ${i}`, () =>
    snarkjs.powersOfTau.contribute(potFiles[potFiles.length - 1], out, id, crypto.randomBytes(32).toString("hex"), silent)
  );
  potFiles.push(out);
  recordHash(`pot:000${i}:${id}`, out);
}

const potBeacon = path.join(D.contributions, "pot_0004_beacon.ptau");
await strict("pot beacon", () =>
  snarkjs.powersOfTau.beacon(potFiles[potFiles.length - 1], potBeacon, "phase4-pot-beacon", BEACON_HASH, BEACON_ITER_EXP, silent)
);
potFiles.push(potBeacon);
const potBeaconHash = recordHash("pot:0004:beacon", potBeacon);

// verify the beacon-topped chain, then preparePhase2
const potVerifyOk = await strict("pot verify", () => snarkjs.powersOfTau.verify(potBeacon, silent));
if (potVerifyOk !== true) abort("powers-of-tau verification FAILED after beacon");
log("PASS powers-of-tau chain verified (beacon-topped)");

const ptauFinal = path.join(D.final, "phase4-ptau.ptau");
await strict("pot preparePhase2", () => snarkjs.powersOfTau.preparePhase2(potBeacon, ptauFinal, silent));
const ptauFinalHash = recordHash("pot:final", ptauFinal);

// --- GROTH16 ZKEY CHAIN --------------------------------------------------------
log("--- GROTH16 ZKEY (canonical R1CS) ---");
const zkFiles = [];
const zkInit = path.join(D.contributions, "zkey_0000_init.zkey");
await strict("zkey new", () => snarkjs.zKey.newZKey(R1CS, ptauFinal, zkInit, silent));
zkFiles.push(zkInit);
recordHash("zkey:0000:init", zkInit);

for (let i = 1; i <= N_CONTRIBUTORS; i++) {
  const id = `phase4-zkey-contributor-${i}`;
  const out = path.join(D.contributions, `zkey_000${i}_${id}.zkey`);
  await strict(`zkey contribute ${i}`, () =>
    snarkjs.zKey.contribute(zkFiles[zkFiles.length - 1], out, id, crypto.randomBytes(32).toString("hex"), silent)
  );
  zkFiles.push(out);
  recordHash(`zkey:000${i}:${id}`, out);
  // verify after EVERY contribution (abort condition: contribution hash/verify mismatch)
  const ok = await strict(`zkey verify ${i}`, () => snarkjs.zKey.verifyFromR1cs(R1CS, ptauFinal, out, silent));
  if (ok !== true) abort(`zkey verification FAILED after contribution ${i}`);
  log(`PASS zkey chain verified after contribution ${i}`);
}

const productionZkey = path.join(D.final, "production.zkey");
await strict("zkey beacon", () =>
  snarkjs.zKey.beacon(zkFiles[zkFiles.length - 1], productionZkey, "phase4-zkey-beacon", BEACON_HASH, BEACON_ITER_EXP, silent)
);
const productionZkeyHash = recordHash("zkey:0004:beacon=FINAL", productionZkey);
const zkVerifyOk = await strict("zkey verify final", () => snarkjs.zKey.verifyFromR1cs(R1CS, ptauFinal, productionZkey, silent));
if (zkVerifyOk !== true) abort("FINAL production zkey verification FAILED");
log("PASS final production zkey verified against canonical R1CS + ceremony ptau");

// --- PRODUCTION VERIFICATION KEY ----------------------------------------------
const vkey = await strict("export vkey", () => snarkjs.zKey.exportVerificationKey(productionZkey, silent));
if (vkey.protocol !== "groth16") abort(`unexpected vkey protocol: ${vkey.protocol}`);
if (vkey.nPublic !== 30) abort(`unexpected vkey nPublic: ${vkey.nPublic}`);
if (!Array.isArray(vkey.IC) || vkey.IC.length !== 31) abort(`unexpected IC length: ${vkey.IC?.length}`);
const vkeyPath = path.join(D.final, "production-vkey.json");
fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2), "utf8");
const productionVkeyHash = recordHash("vkey:final", vkeyPath);

// --- DEV/PRODUCTION SEPARATION GUARD -------------------------------------------
for (const [name, prefix] of Object.entries(DEV_HASHES)) {
  for (const s of hashRecord.steps) {
    if (s.sha256.startsWith(prefix)) abort(`dev artifact promoted to production: ${name} == ${s.step}`);
  }
}
log("PASS dev/production separation: no dev hash appears in any phase4 artifact");

// --- BEACON RECORD ---------------------------------------------------------------
fs.writeFileSync(
  path.join(D.beacon, "beacon-record.json"),
  JSON.stringify(
    {
      source: "Bitcoin genesis block hash (public, immutable, independently verifiable)",
      beaconHash: BEACON_HASH,
      iterationsExp: BEACON_ITER_EXP,
      iterations: 2 ** BEACON_ITER_EXP,
      appliedTo: [
        { chain: "powers-of-tau", output: "contributions/pot_0004_beacon.ptau", sha256: potBeaconHash },
        { chain: "groth16-zkey", output: "final/production.zkey", sha256: productionZkeyHash },
      ],
      recordedAt: new Date().toISOString(),
    },
    null,
    2
  ),
  "utf8"
);

// --- FINALIZE ---------------------------------------------------------------------
metadata.completedAt = new Date().toISOString();
metadata.durationSeconds = Math.round((Date.now() - t0) / 1000);
metadata.finalArtifacts = {
  ptau: { path: "artifacts/phase4/final/phase4-ptau.ptau", sha256: ptauFinalHash },
  zkey: { path: "artifacts/phase4/final/production.zkey", sha256: productionZkeyHash },
  vkey: { path: "artifacts/phase4/final/production-vkey.json", sha256: productionVkeyHash },
};
fs.writeFileSync(path.join(D.ceremony, "ceremony-metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
fs.writeFileSync(path.join(D.hashes, "hashes.json"), JSON.stringify(hashRecord, null, 2), "utf8");
flushTranscript("ceremony-transcript.log");

log(`CEREMONY COMPLETE in ${metadata.durationSeconds}s`);
log(`FINAL production.zkey : ${productionZkeyHash}`);
log(`FINAL production vkey : ${productionVkeyHash}`);
log(`FINAL ceremony ptau   : ${ptauFinalHash}`);
log("Production verifier contract generation is a SEPARATE post-ceremony step (authorized only after this VK is finalized).");
process.exit(0);
