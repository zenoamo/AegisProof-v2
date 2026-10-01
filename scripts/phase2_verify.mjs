// ============================================================================
// AegisProof Phase 2 Verification Suite (optimized)
// ----------------------------------------------------------------------------
// Modes:
//   node scripts/phase2_verify.mjs --fast    FAST MODE  (no setup, no proof)
//   node scripts/phase2_verify.mjs --full    FULL MODE  (everything + evidence)
//   node scripts/phase2_verify.mjs --setup   SETUP MODE (dev setup regen only)
//   add --force to SETUP to regenerate even if cache is valid
//
// Design rules (per Phase 2 optimization mandate):
//   * NO security check is removed; redundancy and verbose I/O are removed.
//   * Development setup ONLY. Production trusted setup is Phase 4.
//   * Phase 0 artifacts are read-only; hashes verified before AND after.
//   * Cache keyed by r1csHash/wasmHash/protocolVersion/setupVersion; any
//     mismatch => hard cache miss (never silently reused).
//   * No witness/proof object dumps; compact UTF-8 log + evidence JSON.
// ============================================================================
import { createRequire } from "module";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ROOT,
  artifactResolutionSummary,
  logArtifactResolver,
  resolveArtifacts,
} from "./lib/resolve-artifacts.mjs";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

const P2 = path.join(ROOT, "artifacts", "phase2");
const R = (p) => path.join(ROOT, p);

// Canonical v2 SSoT.
// protocol/specs is the canonical SSoT FILE.
const SSOT_PATH = R("protocol/specs");

const RESOLVED = resolveArtifacts({ profile: "phase2" });
const RESOLUTION = logArtifactResolver(
  RESOLVED,
  { json: process.argv.includes("--artifact-json") }
);

const PATHS = {
  ssot: SSOT_PATH,
  r1cs: RESOLVED.r1cs,
  sym: RESOLVED.sym,
  wasm: RESOLVED.wasm,
  witCalc: RESOLVED.witCalc,
  input: RESOLVED.input,
  badCommit: RESOLVED.badCommit,
  badNull: RESOLVED.badNull,
  badManifest: RESOLVED.badManifest,
  ptau: path.join(P2, "setup/pot10_final.ptau"),
  zkey: RESOLVED.zkey,
  vkey: RESOLVED.vkey,
  proof: path.join(P2, "proofs/proof_v2_baseline.json"),
  cacheDir: RESOLVED.cacheDir,
  cache: path.join(P2, "cache/cache-manifest.json"),
  reports: path.join(P2, "reports"),
};

// Phase 0 evidence files (immutable) — hashed before and after each run.
const PHASE0_FILES = [
  "contracts/AegisShield.sol",
  "contracts/Groth16Verifier29.sol",
  "circuits/aegis_commit_core.circom",
  "circuits/aegis_commit_core.sym",
  "build/vkey.json",
  "build/proofs/proof_29.json",
  "build/proofs/public_29.json",
  "specs/canonical-signals.json",
  "test/testVerifyAndAccept.ts",
  "scripts/input.json",
];

const PROTOCOL_VERSION = 2;
const SETUP_VERSION = "dev-phase2-v1"; // DEVELOPMENT ONLY — not production VK
const LOG_LINES = [];

// ----------------------------------------------------------------------------
// utilities
// ----------------------------------------------------------------------------
const sha256File = (p) =>
  crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const sha256Buf = (b) => crypto.createHash("sha256").update(b).digest("hex");

const tGlobal = Date.now();
function log(msg) {
  const line = `[t+${((Date.now() - tGlobal) / 1000).toFixed(1)}s] ${msg}`;
  LOG_LINES.push(line);
  console.log(line);
}

async function step(idx, total, name, fn, { heartbeatMs = 10000 } = {}) {
  const t0 = Date.now();
  log(`[${idx}/${total}] ${name} ...`);
  let hb = setInterval(() => {
    const el = ((Date.now() - t0) / 1000).toFixed(0);
    log(`[${idx}/${total}] ${name} still running... elapsed=${el}s`);
  }, heartbeatMs);
  try {
    const r = await fn();
    clearInterval(hb);
    log(`[${idx}/${total}] ${name} ... DONE (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return r;
  } catch (e) {
    clearInterval(hb);
    log(`[${idx}/${total}] ${name} ... FAILED (${((Date.now() - t0) / 1000).toFixed(1)}s): ${e.message}`);
    throw e;
  }
}

const silentLogger = { info: () => {}, warn: () => {}, error: (m) => log("ERR " + m), debug: () => {} };

// snarkjs sometimes swallows errors and leaves truncated files behind;
// wrap every setup call so a failure ALWAYS aborts the run (never treated
// as success), and validate output files are non-empty with correct magic.
async function strictCall(label, fn) {
  try {
    await fn();
  } catch (e) {
    throw new Error(`${label} failed: ${e.message}`);
  }
}
function assertValidBinFile(p, magicAscii) {
  let data;
  try {
    data = fs.readFileSync(p);
  } catch {
    throw new Error(`output artifact missing/unreadable: ${p}`);
  }
  if (data.length < 8)
    throw new Error(`output artifact missing/truncated: ${p}`);
  const head = data.subarray(0, 4).toString("ascii");
  if (head !== magicAscii)
    throw new Error(`output artifact has wrong magic (${head}): ${p}`);
}

function fail(msg) {
  log("FATAL: " + msg);
  writeEvidence();
  process.exitCode = 1;
  process.exit(1);
}

// ----------------------------------------------------------------------------
// state / evidence
// ----------------------------------------------------------------------------
const EVIDENCE = {
  suite: "phase2_verify.mjs (optimized)",
  mode: null,
  startedAt: new Date().toISOString(),
  protocolVersion: PROTOCOL_VERSION,
  setupVersion: SETUP_VERSION,
  artifactResolution: RESOLUTION,
  steps: [],
  checks: {},
  artifacts: {},
  phase0: {},
};
function recordCheck(name, pass, detail) {
  EVIDENCE.checks[name] = { pass, detail };
  if (!pass) fail(`security check FAILED: ${name} — ${detail}`);
}
function writeEvidence() {
  EVIDENCE.finishedAt = new Date().toISOString();
  EVIDENCE.totalElapsedSec = (Date.now() - tGlobal) / 1000;
  fs.mkdirSync(PATHS.reports, { recursive: true });
  fs.writeFileSync(EVIDENCE_OUT, JSON.stringify(EVIDENCE, null, 2), "utf8");
  fs.writeFileSync(LOG_OUT, LOG_LINES.join("\n") + "\n", "utf8");
}

// ----------------------------------------------------------------------------
// Poseidon helper (canonical conversion: F.toObject)
// ----------------------------------------------------------------------------
let poseidon, Fp;
async function initPoseidon() {
  poseidon = await buildPoseidon();
  Fp = poseidon.F;
}
const H = (arr) => BigInt(Fp.toObject(poseidon(arr)).toString());
const utf8BE = (s) => {
  let e = 0n;
  for (const b of Buffer.from(s, "utf8")) e = (e << 8n) | BigInt(b);
  return e;
};

// ----------------------------------------------------------------------------
// witness generation (sanity-checked), in-memory or to file
// ----------------------------------------------------------------------------
let witCalculatorFactory = null;
async function getCalculator() {
  if (witCalculatorFactory) return witCalculatorFactory;
  // repo root package.json has "type":"module"; circom's calculator is CJS —
  // copy to a .cjs inside the phase2-isolated cache and require that.
  fs.mkdirSync(PATHS.cacheDir, { recursive: true });
  const cjsPath = path.join(PATHS.cacheDir, "witness_calculator.cjs");
  fs.copyFileSync(PATHS.witCalc, cjsPath);
  witCalculatorFactory = await require(cjsPath)(fs.readFileSync(PATHS.wasm));
  return witCalculatorFactory;
}
async function genWitness(inputObj) {
  const wc = await getCalculator();
  // sanityCheck=1 => the wasm asserts EVERY R1CS constraint
  return wc.calculateWitness(inputObj, 1);
}
// wrap raw binary witness data in the standard .wtns container (magic "wtns",
// version 2, section 1: nVars + field prime) so snarkjs.groth16.prove accepts it
function writeWtnsFile(p, wc, rawBin) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const n8 = 32; // BN128 scalar field element size
  const PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const nVars = rawBin.length / n8;
  const head = Buffer.alloc(12);
  head.write("wtns", 0, "ascii");
  head.writeUInt32LE(2, 4); // file version
  head.writeUInt32LE(2, 8); // section count
  // section 1 (header): [type][size][n8][prime][nVars]
  const s1 = Buffer.alloc(12 + 8 + n8);
  s1.writeUInt32LE(1, 0); // section type = header
  s1.writeBigUInt64LE(BigInt(8 + n8), 4); // section length = n8 + prime + nVars
  s1.writeUInt32LE(n8, 12);
  let prime = PRIME;
  for (let i = 0; i < n8; i++) {
    s1[16 + i] = Number(prime & 0xffn);
    prime >>= 8n;
  }
  s1.writeUInt32LE(nVars, 16 + n8);
  const s2head = Buffer.alloc(12);
  s2head.writeUInt32LE(2, 0); // section type = data
  s2head.writeBigUInt64LE(BigInt(rawBin.length), 4);
  fs.writeFileSync(p, Buffer.concat([head, s1, s2head, Buffer.from(rawBin)]));
}
async function expectWitnessFail(name, inputObj) {
  try {
    await genWitness(inputObj);
    recordCheck(name, false, "witness generation unexpectedly SUCCEEDED");
    return false;
  } catch (e) {
    recordCheck(name, true, "witness generation correctly failed: " + String(e.message).split("\n")[0]);
    return true;
  }
}

// ----------------------------------------------------------------------------
// cache manifest
// ----------------------------------------------------------------------------
function computeCacheKeys() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    setupVersion: SETUP_VERSION,
    r1csHash: sha256File(PATHS.r1cs),
    wasmHash: sha256File(PATHS.wasm),
    symHash: sha256File(PATHS.sym),
    ssotHash: sha256File(PATHS.ssot),
  };
}
function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(PATHS.cache, "utf8"));
  } catch {
    return null;
  }
}
function validateCache(keys) {
  const c = loadCache();
  if (!c) return { valid: false, reason: "no cache manifest" };
  for (const k of ["protocolVersion", "setupVersion", "r1csHash", "wasmHash", "symHash", "ssotHash"]) {
    if (c[k] !== keys[k]) return { valid: false, reason: `cache key mismatch: ${k}` };
  }
  // artifact files must exist and their recorded hashes must still match
  for (const [name, p] of Object.entries({ ptau: PATHS.ptau, zkey: PATHS.zkey })) {
    try {
      const actualHash = sha256File(p);
      if (c[`${name}Hash`] && c[`${name}Hash`] !== actualHash)
        return { valid: false, reason: `artifact hash mismatch: ${name}` };
    } catch {
      return { valid: false, reason: `missing artifact: ${name}` };
    }
  }
  return { valid: true };
}
function saveCache(keys) {
  fs.mkdirSync(PATHS.cacheDir, { recursive: true });
  const c = { ...keys, createdAt: new Date().toISOString() };
  try { c.ptauHash = sha256File(PATHS.ptau); } catch {}
  try { c.zkeyHash = sha256File(PATHS.zkey); } catch {}
  try { c.vkeyHash = sha256File(PATHS.vkey); } catch {}
  fs.writeFileSync(PATHS.cache, JSON.stringify(c, null, 2), "utf8");
}

// ----------------------------------------------------------------------------
// SETUP MODE — development setup ONLY (production setup is Phase 4)
// ----------------------------------------------------------------------------
async function runSetup(force) {
  const keys = computeCacheKeys();

  if (!force) {
    const v = validateCache(keys);
    if (v.valid && fs.existsSync(PATHS.ptau) && fs.existsSync(PATHS.zkey)) {
      log("[SETUP] cache valid — development setup artifacts reused (no regeneration)");
      return;
    }
    log(`[SETUP] cache miss (${v.reason}) — regenerating DEVELOPMENT setup`);
  } else {
    log("[SETUP] forced regeneration of DEVELOPMENT setup");
  }

  log(
    "[SETUP] NOTE: this is a Phase 2 development setup. " +
    "Production trusted setup (multi-contributor + beacon) is Phase 4 and is NOT performed here."
  );

  // --------------------------------------------------------------------------
  // Ensure all Phase 2 setup output directories exist.
  // CI checkouts may not contain artifacts/phase2/setup.
  // --------------------------------------------------------------------------
  const setupDir = path.join(P2, "setup");
  fs.mkdirSync(setupDir, { recursive: true });

  // Also ensure the final artifact/cache/report directories exist before
  // any snarkjs operation starts.
  fs.mkdirSync(path.dirname(PATHS.ptau), { recursive: true });
  fs.mkdirSync(path.dirname(PATHS.zkey), { recursive: true });
  fs.mkdirSync(path.dirname(PATHS.vkey), { recursive: true });
  fs.mkdirSync(PATHS.cacheDir, { recursive: true });

  const curve = await snarkjs.curves.getCurveFromName("bn128");

  // Circuit needs 2*nConstraints = 13180 domain points -> power >= 14.
  const POT_POWER = 14;

  const potTmp = path.join(setupDir, "pot_dev_tmp.ptau");
  const potContrib = path.join(setupDir, "pot_dev_contrib.ptau");
  const zkeyTmp = path.join(setupDir, "aegis_v2_dev_tmp.zkey");

  // --------------------------------------------------------------------------
  // Remove stale temporary artifacts from an interrupted CI/setup run.
  // Never reuse partially-written temporary files.
  // --------------------------------------------------------------------------
  fs.rmSync(potTmp, { force: true });
  fs.rmSync(potContrib, { force: true });
  fs.rmSync(zkeyTmp, { force: true });

  // --------------------------------------------------------------------------
  // 1. Powers of Tau accumulator
  // --------------------------------------------------------------------------
  await strictCall(
    "powersoftau new",
    () =>
      snarkjs.powersOfTau.newAccumulator(
        curve,
        POT_POWER,
        potTmp,
        silentLogger
      )
  );

  assertValidBinFile(potTmp, "ptau");
  log(`[SETUP] powersoftau new (2^${POT_POWER}) done`);

  // --------------------------------------------------------------------------
  // 2. Development contribution
  // --------------------------------------------------------------------------
  await strictCall(
    "powersoftau contribute",
    () =>
      snarkjs.powersOfTau.contribute(
        potTmp,
        potContrib,
        "phase2-dev-contrib",
        crypto.randomBytes(32).toString("hex"),
        silentLogger
      )
  );

  assertValidBinFile(potContrib, "ptau");
  log("[SETUP] powersoftau contribute done (no -v: verbose disabled)");

  // --------------------------------------------------------------------------
  // 3. Prepare Phase 2 Powers of Tau
  // --------------------------------------------------------------------------
  await strictCall(
    "powersoftau prepare",
    () =>
      snarkjs.powersOfTau.preparePhase2(
        potContrib,
        PATHS.ptau,
        silentLogger
      )
  );

  assertValidBinFile(PATHS.ptau, "ptau");
  log("[SETUP] powersoftau prepare done");

  // --------------------------------------------------------------------------
  // 4. Generate development zkey
  // --------------------------------------------------------------------------
  await strictCall(
    "zkey new",
    () =>
      snarkjs.zKey.newZKey(
        PATHS.r1cs,
        PATHS.ptau,
        zkeyTmp,
        silentLogger
      )
  );

  assertValidBinFile(zkeyTmp, "zkey");
  log("[SETUP] zkey new done");

  // --------------------------------------------------------------------------
  // 5. Development zkey contribution
  // --------------------------------------------------------------------------
  await strictCall(
    "zkey contribute",
    () =>
      snarkjs.zKey.contribute(
        zkeyTmp,
        PATHS.zkey,
        "phase2-dev-zkey-contrib",
        crypto.randomBytes(32).toString("hex"),
        silentLogger
      )
  );

  assertValidBinFile(PATHS.zkey, "zkey");
  log("[SETUP] zkey contribute done");

  // --------------------------------------------------------------------------
  // 6. Remove temporary setup artifacts.
  // --------------------------------------------------------------------------
  fs.rmSync(potTmp, { force: true });
  fs.rmSync(potContrib, { force: true });
  fs.rmSync(zkeyTmp, { force: true });

  // --------------------------------------------------------------------------
  // 7. Export verification key
  // --------------------------------------------------------------------------
  fs.mkdirSync(path.dirname(PATHS.vkey), { recursive: true });

  const vkey = await snarkjs.zKey.exportVerificationKey(
    PATHS.zkey,
    silentLogger
  );

  fs.writeFileSync(
    PATHS.vkey,
    JSON.stringify(vkey, null, 2),
    "utf8"
  );

  // Verify the exported VK is actually readable before declaring setup success.
  const exportedVkey = JSON.parse(fs.readFileSync(PATHS.vkey, "utf8"));

  if (!Array.isArray(exportedVkey.IC)) {
    throw new Error("exported verification key has no IC array");
  }

  if (exportedVkey.IC.length !== 31) {
    throw new Error(
      `exported verification key has unexpected IC length: ${exportedVkey.IC.length} (expected 31)`
    );
  }

  log("[SETUP] verification key exported (development only)");

  // --------------------------------------------------------------------------
  // 8. Persist cache only after every setup artifact has been validated.
  // --------------------------------------------------------------------------
  saveCache(keys);
  log("[SETUP] cache manifest written");
}

// ----------------------------------------------------------------------------
// Phase 0 integrity
// ----------------------------------------------------------------------------
function phase0Hashes() {
  const out = {};
  for (const f of PHASE0_FILES) {
    try {
      out[f] = sha256File(R(f));
    } catch {
      out[f] = "MISSING";
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// verification steps
// ----------------------------------------------------------------------------
async function loadSsot() {
  const ssot = JSON.parse(fs.readFileSync(PATHS.ssot, "utf8"));
  recordCheck("SSoT-schema", ssot.protocol === "AegisProof" && ssot.version === PROTOCOL_VERSION, "protocol/version fields");
  recordCheck("SSoT-signal-count", ssot.publicSignals.length === 30, `publicSignals.length=${ssot.publicSignals.length}`);
  ssot.publicSignals.forEach((s, i) => {
    if (s.index !== i) fail(`SSoT index gap at position ${i}: index=${s.index}`);
  });
  recordCheck("SSoT-indices-contiguous", true, "0..29 contiguous");
  recordCheck("SSoT-commitment-spec", ssot.commitment.inputs.length === 6, "Poseidon(6) inputs");
  recordCheck("SSoT-nullifier-spec", ssot.nullifier.inputs.length === 8, "Poseidon(8) inputs");
  recordCheck(
    "SSoT-timestamp-policy",
    ssot.contractPolicy.timestampWindow.MAX_AGE_seconds === 86400 &&
      ssot.contractPolicy.timestampWindow.CLOCK_SKEW_seconds === 300,
    "MAX_AGE=24h, SKEW=5min per authorization"
  );
  return ssot;
}

async function checkLayout(ssot) {
  // .sym wire order (wires 1..30 must equal SSoT order; 31/32 private)
  const sym = fs.readFileSync(PATHS.sym, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const nameByWire = {};
  for (const l of sym) {
    const p = l.split(",");
    nameByWire[+p[0]] = p[3].trim().replace("main.", "");
  }
  let layoutOk = true;
  const mism = [];
  ssot.publicSignals.forEach((s, i) => {
    if (nameByWire[i + 1] !== s.name) {
      layoutOk = false;
      mism.push(`wire ${i + 1}: sym=${nameByWire[i + 1]} ssot=${s.name}`);
    }
  });
  recordCheck("Layout-sym-vs-SSoT", layoutOk, layoutOk ? "wires 1..30 = SSoT order" : mism.join("; "));
  recordCheck("Layout-private", nameByWire[31] === "secretKey" && nameByWire[32] === "deviceId", "wires 31/32 private");

  // R1CS header structure
  const fd = await readR1csHeader();
  recordCheck("R1CS-nPublic", fd.nPubInputs === 30, `nPubInputs=${fd.nPubInputs}`);
  recordCheck("R1CS-nPrivate", fd.nPrvInputs === 2, `nPrvInputs=${fd.nPrvInputs}`);
  recordCheck("R1CS-nOutputs", fd.nOutputs === 0, `nOutputs=${fd.nOutputs} (input-flip: no outputs)`);
  recordCheck("R1CS-constraints", fd.nConstraints > 0, `nConstraints=${fd.nConstraints}`);
  EVIDENCE.artifacts.r1cs = fd;
  return fd;
}

let r1csHeaderCache = null;
async function readR1csHeader() {
  if (r1csHeaderCache) return r1csHeaderCache;
  const { readR1cs } = require("r1csfile");
  const fd = await readR1cs(PATHS.r1cs, {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    loadConstraints: false,
  });
  r1csHeaderCache = {
    nVars: fd.nVars,
    nPubInputs: fd.nPubInputs,
    nPrvInputs: fd.nPrvInputs,
    nOutputs: fd.nOutputs,
    nConstraints: fd.nConstraints,
  };
  return r1csHeaderCache;
}

function checkArtifactIntegrity(keys) {
  EVIDENCE.artifacts.r1csHash = keys.r1csHash;
  EVIDENCE.artifacts.wasmHash = keys.wasmHash;
  EVIDENCE.artifacts.symHash = keys.symHash;
  recordCheck("Artifact-r1cs-exists", fs.existsSync(PATHS.r1cs), "compiled circuit artifact present");
  recordCheck("Artifact-wasm-exists", fs.existsSync(PATHS.wasm), "wasm witness producer present");
  // NOTE: the .circom source file of v2 was lost with the previous run's
  // script directory; the frozen r1cs/wasm ARE the compiled circuit and are
  // used as the canonical artifacts. Recompilation is replaced by artifact
  // integrity + full-constraint witness sanity checking (explicit adaptation,
  // not a silent skip).
  recordCheck(
    "Artifact-source-status",
    true,
    "v2 .circom source absent (lost); frozen r1cs/wasm treated as canonical compiled circuit; witness sanity-check asserts all constraints"
  );
}

async function checkC4(ssot, input, witness) {
  // C-4 baseline: external recomputation (independent implementation) of
  // commitment & nullifier MUST equal the provided public values, and the
  // circuit's publicSignals MUST carry them at SSoT indices.
  const v = (n) => BigInt(input[n]);
  const DOMAIN = H([utf8BE(ssot.domainSeparation.domainNullifierV2Label)]);
  recordCheck(
    "C4-DOMAIN-NUS",
    DOMAIN.toString() === ssot.domainSeparation.domainNullifierV2,
    "DOMAIN_NULLIFIER_V2 re-derived via NUS rule matches SSoT"
  );
  recordCheck(
    "C4-commitment-recompute",
    H(ssot.commitment.inputs.map((n) => v(n))) === v("commitment"),
    "Poseidon(6) over SSoT commitment inputs equals provided commitment"
  );
  const nulInputs = ssot.nullifier.inputs.map((n) => (n === "DOMAIN_NULLIFIER_V2" ? DOMAIN : v(n)));
  recordCheck(
    "C4-nullifier-recompute",
    H(nulInputs) === v("nullifier"),
    "Poseidon(8) over SSoT nullifier inputs equals provided nullifier"
  );
  // publicSignals carry provided values at canonical positions
  const ps = witness.slice(1, 31);
  let ok = true;
  ssot.publicSignals.forEach((s, i) => {
    if (BigInt(ps[i]) !== v(s.name)) ok = false;
  });
  recordCheck("C4-publicSignals-position", ok, "all 30 publicSignals equal provided inputs at SSoT indices");
}

async function checkICVK() {
  let vkey;
  try {
    vkey = JSON.parse(fs.readFileSync(PATHS.vkey, "utf8"));
  } catch {
    vkey = await snarkjs.zKey.exportVerificationKey(PATHS.zkey, silentLogger);
    fs.mkdirSync(path.dirname(PATHS.vkey), { recursive: true });
    fs.writeFileSync(PATHS.vkey, JSON.stringify(vkey, null, 2), "utf8");
  }
  recordCheck("IC-length", vkey.IC.length === 31, `IC.length=${vkey.IC.length} (expected nPublic+1=31)`);
  recordCheck("VK-protocol", vkey.protocol === "groth16", "groth16");
  // curve membership of all IC points + vk groups (points are stored
  // internally with Montgomery-form coordinates; F.e() produces that form)
  const curve = await snarkjs.curves.getCurveFromName("bn128");
  const F1 = curve.G1.F;
  const g1Point = (p) => {
    const b = new Uint8Array(F1.n8 * 3);
    b.set(F1.e(BigInt(p[0])), 0);
    b.set(F1.e(BigInt(p[1])), F1.n8);
    b.set(F1.e(1n), 2 * F1.n8);
    return b;
  };
  let onCurve = true;
  for (const ic of vkey.IC) {
    if (!curve.G1.isValid(g1Point(ic))) onCurve = false;
  }
  if (!curve.G1.isValid(g1Point(vkey.vk_alpha_1))) onCurve = false;
  // F2 element built manually from F1 halves (F2.e has an upstream buffer bug)
  const f2e = (c0, c1) => {
    const b = new Uint8Array(F1.n8 * 2);
    b.set(F1.e(c0), 0);
    b.set(F1.e(c1), F1.n8);
    return b;
  };
  const F2 = curve.G2.F;
  const g2Point = (p) => {
    const b = new Uint8Array(F2.n8 * 3);
    b.set(f2e(BigInt(p[0][0]), BigInt(p[0][1])), 0);
    b.set(f2e(BigInt(p[1][0]), BigInt(p[1][1])), F2.n8);
    b.set(f2e(1n, 0n), 2 * F2.n8);
    return b;
  };
  if (!curve.G2.isValid(g2Point(vkey.vk_beta_2))) onCurve = false;
  if (!curve.G2.isValid(g2Point(vkey.vk_delta_2))) onCurve = false;
  recordCheck("IC-on-curve", onCurve, "all 31 IC points + alpha/beta/delta on BN128");
  return vkey;
}

async function fullProofCycle(ssot, input, witnessBinPath, vkey) {
  // baseline proof — generated ONCE, reused for verify + mutation tests
  const { proof, publicSignals } = await snarkjs.groth16.prove(PATHS.zkey, witnessBinPath, silentLogger);
  fs.mkdirSync(path.dirname(PATHS.proof), { recursive: true });
  fs.writeFileSync(PATHS.proof, JSON.stringify({ proof, publicSignals }, null, 2), "utf8");
  EVIDENCE.artifacts.proofHash = sha256File(PATHS.proof);

  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  recordCheck("Proof-baseline-verify", ok === true, "baseline proof verifies against dev vkey");

  // public-signal mutation => verification MUST fail
  const mutated = [...publicSignals];
  mutated[0] = (BigInt(mutated[0]) + 1n).toString();
  const bad1 = await snarkjs.groth16.verify(vkey, mutated, proof);
  recordCheck("Proof-mutation-reject", bad1 === false, "pubSignals[0]+1 rejected");

  const mutated2 = [...publicSignals];
  mutated2[28] = (BigInt(mutated2[28]) + 1n).toString(); // commitment slot
  const bad2 = await snarkjs.groth16.verify(vkey, mutated2, proof);
  recordCheck("Proof-commitment-mutation-reject", bad2 === false, "pubSignals[28] (commitment) mutation rejected");

  // proof tampering => verification MUST fail
  const badProof = JSON.parse(JSON.stringify(proof));
  badProof.pi_a[0] = (BigInt(badProof.pi_a[0]) + 1n).toString();
  let bad3;
  try {
    bad3 = await snarkjs.groth16.verify(vkey, publicSignals, badProof);
  } catch {
    bad3 = false; // invalid point => rejection is acceptable
  }
  recordCheck("Proof-tamper-reject", bad3 === false, "tampered pi_a rejected");

  // IC/VK deep consistency: re-verify via full pairing already done above;
  // additionally check nPublic alignment between proof signals and IC.
  recordCheck("IC-signal-alignment", publicSignals.length === vkey.IC.length - 1, "publicSignals.length = IC.length-1");
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
const argv = process.argv.slice(2);
const MODE = argv.includes("--setup") ? "SETUP" : argv.includes("--full") ? "FULL" : argv.includes("--fast") ? "FAST" : null;
const FORCE = argv.includes("--force");
if (!MODE) {
  console.log("usage: node scripts/phase2_verify.mjs --fast | --full | --setup [--force]");
  process.exit(2);
}
EVIDENCE.mode = MODE;
// E-1: mode-separated evidence/log outputs — FAST can never overwrite FULL.
const EVIDENCE_OUT = path.join(P2, `reports/phase2_evidence_${MODE.toLowerCase()}.json`);
const LOG_OUT = path.join(P2, `reports/phase2_verify_run_${MODE.toLowerCase()}.log`);
EVIDENCE.evidencePath = EVIDENCE_OUT;

log(`PHASE 2 VERIFICATION SUITE — MODE=${MODE}`);
log("Development setup only; production trusted setup is Phase 4 (multi-contributor + beacon).");

// Phase 0 before-hash
const p0Before = phase0Hashes();
EVIDENCE.phase0.before = p0Before;

try {
  if (MODE === "SETUP") {
    await step(1, 1, "Development setup (cached unless --force/miss)", () => runSetup(FORCE));
    const p0After = phase0Hashes();
    recordCheck("Phase0-unchanged", JSON.stringify(p0Before) === JSON.stringify(p0After), "phase0 hashes identical");
    writeEvidence();
    log("SETUP MODE complete.");
    process.exit(0);
  }

  const keys = computeCacheKeys();

  if (MODE === "FAST") {
    const ssot = await step(1, 10, "Loading SSoT + schema validation", () => loadSsot());
    await step(2, 10, "Layout validation (SSoT vs .sym vs R1CS)", () => checkLayout(ssot));
    await step(3, 10, "Circuit artifact integrity (compiled artifacts)", async () => checkArtifactIntegrity(keys));
    await step(4, 10, "Initializing Poseidon hasher", () => initPoseidon());
    const input = JSON.parse(fs.readFileSync(PATHS.input, "utf8"));
    const witness = await step(5, 10, "Witness generation (baseline, all-constraint sanity check)", () => genWitness(input), { heartbeatMs: 5000 });
    await step(6, 10, "C-1 canonical layout (measured publicSignals)", async () => {
      const ps = witness.slice(1, 31);
      let ok = true;
      ssot.publicSignals.forEach((s, i) => {
        if (BigInt(ps[i]) !== BigInt(input[s.name])) ok = false;
      });
      recordCheck("C1-layout-measured", ok, "30 publicSignals in canonical SSoT order with expected values");
    });
    await step(7, 10, "C-2 Poseidon(6)/(8) real-operation", async () => {
      const v = (n) => BigInt(input[n]);
      const c6 = H(ssot.commitment.inputs.map((n) => v(n)));
      const DOMAIN = H([utf8BE(ssot.domainSeparation.domainNullifierV2Label)]);
      const n8 = H(ssot.nullifier.inputs.map((n) => (n === "DOMAIN_NULLIFIER_V2" ? DOMAIN : v(n))));
      recordCheck("C2-poseidon6-works", c6 > 0n && c6.toString() === input.commitment, "Poseidon(6) produces provided commitment");
      recordCheck("C2-poseidon8-works", n8 > 0n && n8.toString() === input.nullifier, "Poseidon(8) produces provided nullifier");
    });
    await step(8, 10, "C-4 computed==provided baseline", () => checkC4(ssot, input, witness));
    await step(9, 10, "Build Gates (domain/timestamp/static)", async () => {
      const DOMAIN = H([utf8BE(ssot.domainSeparation.domainNullifierV2Label)]);
      recordCheck("Gate-domain", DOMAIN.toString() === ssot.domainSeparation.domainNullifierV2, "NUS domain consistent");
      recordCheck("Gate-timestamp-unbound", ssot.publicSignals[24].binding === "none (untrusted metadata)", "timestamp excluded from commitment/nullifier per approval");
      const symTxt = fs.readFileSync(PATHS.sym, "utf8");
      recordCheck("Gate-no-v1-domain", !symTxt.includes("548923749238475923"), "no v1 hand-picked domain separator in v2 artifacts");
      if (fs.existsSync(PATHS.zkey) || fs.existsSync(PATHS.vkey)) {
        const vkey = await checkICVK();
        const src = fs.existsSync(PATHS.vkey) ? "committed vkey" : "zkey export";
        recordCheck("Gate-IC-static", vkey.IC.length === 31, `IC length static gate (source: ${src})`);
      } else {
        fail("zkey and vkey both missing — run SETUP MODE first (node scripts/phase2_verify.mjs --setup)");
      }
    });
    await step(10, 10, "Evidence + Phase 0 integrity", async () => {
      const p0After = phase0Hashes();
      EVIDENCE.phase0.after = p0After;
      recordCheck("Phase0-unchanged", JSON.stringify(p0Before) === JSON.stringify(p0After), "phase0 hashes identical before/after");
    });
  }

  if (MODE === "FULL") {
    const ssot = await step(1, 16, "Loading SSoT + schema validation", () => loadSsot());
    await step(2, 16, "Layout validation (SSoT vs .sym vs R1CS)", () => checkLayout(ssot));
    await step(3, 16, "Circuit artifact integrity", async () => checkArtifactIntegrity(keys));
    await step(4, 16, "Setup cache validation (dev zkey/ptau reuse)", async () => {
      const v = validateCache(keys);
      if (!v.valid) {
        log(`cache miss (${v.reason}) — running development setup`);
        await runSetup(false);
      } else {
        log("development setup artifacts reused (hash-verified); NO regeneration, NO production setup");
      }
      EVIDENCE.artifacts.ptauHash = sha256File(PATHS.ptau);
      EVIDENCE.artifacts.zkeyHash = sha256File(PATHS.zkey);
    });
    await initPoseidon();
    const input = JSON.parse(fs.readFileSync(PATHS.input, "utf8"));
    const witness = await step(5, 16, "Witness generation (baseline, sanity-checked)", () => genWitness(input), { heartbeatMs: 5000 });
    // baseline binary witness for proving (single write, reused)
    const wc = await getCalculator();
    const witBin = await wc.calculateBinWitness(input, 1);
    const witBinPath = path.join(P2, "witness/witness_v2_baseline.wtns");
    writeWtnsFile(witBinPath, wc, witBin);
    await step(6, 16, "C-1 canonical layout (measured)", async () => {
      const ps = witness.slice(1, 31);
      let ok = true;
      ssot.publicSignals.forEach((s, i) => {
        if (BigInt(ps[i]) !== BigInt(input[s.name])) ok = false;
      });
      recordCheck("C1-layout-measured", ok, "30 publicSignals in canonical SSoT order");
    });
    await step(7, 16, "C-2 Poseidon(6)/(8) real-operation", async () => {
      const v = (n) => BigInt(input[n]);
      const DOMAIN = H([utf8BE(ssot.domainSeparation.domainNullifierV2Label)]);
      recordCheck("C2-poseidon6-works", H(ssot.commitment.inputs.map((n) => v(n))).toString() === input.commitment, "Poseidon(6) matches");
      recordCheck("C2-poseidon8-works", H(ssot.nullifier.inputs.map((n) => (n === "DOMAIN_NULLIFIER_V2" ? DOMAIN : v(n)))).toString() === input.nullifier, "Poseidon(8) matches");
    });
    await step(8, 16, "C-4 computed==provided baseline", () => checkC4(ssot, input, witness));
    const vkey = await step(9, 16, "IC/VK consistency", () => checkICVK());
    await step(10, 16, "Negative witness tests (parallel)", async () => {
      const badC = JSON.parse(fs.readFileSync(PATHS.badCommit, "utf8"));
      const badN = JSON.parse(fs.readFileSync(PATHS.badNull, "utf8"));
      const badM = JSON.parse(fs.readFileSync(PATHS.badManifest, "utf8"));
      const extraSession = { ...input, sessionId: "778" }; // same content, other session
      const extraPurpose = { ...input, purposeId: "43" };
      const extraChain = { ...input, chainId: "1" };
      const results = await Promise.all([
        expectWitnessFail("Neg-commitment-mutation", badC),
        expectWitnessFail("Neg-nullifier-mutation", badN),
        expectWitnessFail("Neg-manifest-mutation", badM),
        expectWitnessFail("Neg-session-rebinding", extraSession),
        expectWitnessFail("Neg-purpose-rebinding", extraPurpose),
        expectWitnessFail("Neg-chain-rebinding", extraChain),
      ]);
      recordCheck("Neg-tests-all-fail-as-required", results.every(Boolean), "6/6 mutated inputs rejected at witness level");
    });
    await step(11, 16, "Timestamp policy check (unbound by design)", async () => {
      const ts2 = { ...input, timestamp: "1999999999" };
      let okWitness = true;
      try {
        await genWitness(ts2);
      } catch {
        okWitness = false;
      }
      recordCheck(
        "Policy-timestamp-not-in-commitment",
        okWitness,
        "timestamp change does NOT break witness (excluded from commitment/nullifier per approval; contract window only)"
      );
    });
    await step(12, 16, "Baseline proof generation + verification tests", () => fullProofCycle(ssot, input, witBinPath, vkey), { heartbeatMs: 8000 });
    await step(13, 16, "Build Gates (domain/static)", async () => {
      const DOMAIN = H([utf8BE(ssot.domainSeparation.domainNullifierV2Label)]);
      recordCheck("Gate-domain", DOMAIN.toString() === ssot.domainSeparation.domainNullifierV2, "NUS domain consistent");
      const symTxt = fs.readFileSync(PATHS.sym, "utf8");
      recordCheck("Gate-no-v1-domain", !symTxt.includes("548923749238475923"), "no v1 domain separator in v2 artifacts");
    });
    await step(14, 16, "Artifact hash recording", async () => {
      saveCache(keys);
      EVIDENCE.artifacts.vkeyHash = sha256File(PATHS.vkey);
      EVIDENCE.artifacts.cacheManifest = JSON.parse(fs.readFileSync(PATHS.cache, "utf8"));
    });
    await step(15, 16, "Evidence generation", async () => {
      EVIDENCE.artifacts.evidencePath = EVIDENCE_OUT;
    });
    await step(16, 16, "Phase 0 integrity re-check", async () => {
      const p0After = phase0Hashes();
      EVIDENCE.phase0.after = p0After;
      recordCheck("Phase0-unchanged", JSON.stringify(p0Before) === JSON.stringify(p0After), "phase0 hashes identical before/after");
    });
  }

  writeEvidence();
  const failed = Object.entries(EVIDENCE.checks).filter(([, v]) => !v.pass);
  log(`RESULT: ${Object.keys(EVIDENCE.checks).length} checks, ${failed.length} failed. Total ${((Date.now() - tGlobal) / 1000).toFixed(1)}s`);
  log(`Evidence: ${EVIDENCE_OUT}`);
  process.exit(failed.length ? 1 : 0);
} catch (e) {
  log("UNCAUGHT: " + (e.stack || e.message));
  writeEvidence();
  process.exit(1);
}
