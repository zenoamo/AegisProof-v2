// ============================================================================
// Prover abstraction layer (Phase 8.10 Phase 2)
// ----------------------------------------------------------------------------
// Input -> CanonicalProver -> SnarkjsProver | RapidsnarkProver -> Verify -> Result
// Default: snarkjs. rapidsnark: opt-in. Fallback: AEGIS_PROVER_FALLBACK=snarkjs
// No protocol-layer dependencies.
// ============================================================================
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { ROOT } from "./resolve-artifacts.mjs";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

export const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const BN128_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function resolveRapidsnarkBin() {
  const candidates = [
    process.env.RAPIDSNARK_BIN,
    process.env.PROVER_BIN,
    path.join(ROOT, "rapidsnark", "package", "bin", "prover"),
    "rapidsnark",
    "prover",
  ].filter(Boolean);

  for (const bin of candidates) {
    if (fs.existsSync(bin) && fs.statSync(bin).isFile()) return bin;
    try {
      const probe =
        process.platform === "win32"
          ? spawnSync("where", [bin], { encoding: "utf8", timeout: 5000 })
          : spawnSync("which", [bin], { encoding: "utf8", timeout: 5000 });
      if (probe.status === 0) return bin;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

export function isRapidsnarkAvailable() {
  return resolveRapidsnarkBin() !== null;
}

export function getProverName() {
  const name = (process.env.AEGIS_PROVER ?? "snarkjs").toLowerCase();
  if (name !== "snarkjs" && name !== "rapidsnark") {
    throw new Error(`Unsupported AEGIS_PROVER=${process.env.AEGIS_PROVER}`);
  }
  return name;
}

function readRapidsnarkOutput(proofPath, publicPath) {
  const proofRaw = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const publicRaw = JSON.parse(fs.readFileSync(publicPath, "utf8"));
  const publicSignals = Array.isArray(publicRaw)
    ? publicRaw
    : publicRaw.publicSignals ?? publicRaw;
  const proof = proofRaw.proof ?? proofRaw;
  return { proof, publicSignals };
}

/** @typedef {{ prove(zkeyPath: string, wtnsPath: string, scratchDir?: string): Promise<{proof: object, publicSignals: string[]}> }} IProver */

/** @type {IProver} */
export const SnarkjsProver = {
  name: "snarkjs",
  async prove(zkeyPath, wtnsPath) {
    if (!fs.existsSync(zkeyPath)) throw new Error(`zkey not found: ${zkeyPath}`);
    return snarkjs.groth16.prove(zkeyPath, wtnsPath, silentLogger);
  },
};

/** @type {IProver} */
export const RapidsnarkProver = {
  name: "rapidsnark",
  async prove(zkeyPath, wtnsPath, scratchDir) {
    const bin = resolveRapidsnarkBin();
    if (!bin) {
      throw new Error("rapidsnark binary not found (set RAPIDSNARK_BIN)");
    }
    fs.mkdirSync(scratchDir, { recursive: true });
    const proofPath = path.join(scratchDir, `rs-proof-${Date.now()}.json`);
    const publicPath = path.join(scratchDir, `rs-public-${Date.now()}.json`);
    execFileSync(bin, [zkeyPath, wtnsPath, proofPath, publicPath], {
      stdio: "pipe",
      encoding: "utf8",
    });
    const result = readRapidsnarkOutput(proofPath, publicPath);
    fs.rmSync(proofPath, { force: true });
    fs.rmSync(publicPath, { force: true });
    return result;
  },
};

/**
 * Select prover backend with optional fallback to snarkjs.
 * @param {string} [requested] - snarkjs | rapidsnark
 * @param {{ allowFallback?: boolean }} [opts]
 */
export function getProver(requested, opts = {}) {
  const name = (requested ?? getProverName()).toLowerCase();
  const allowFallback =
    opts.allowFallback ??
    (process.env.AEGIS_PROVER_FALLBACK ?? "snarkjs").toLowerCase() === "snarkjs";

  if (name === "rapidsnark") {
    if (isRapidsnarkAvailable()) return RapidsnarkProver;
    if (allowFallback) {
      console.warn("WARN: rapidsnark unavailable — falling back to snarkjs");
      return SnarkjsProver;
    }
    throw new Error("rapidsnark requested but binary not available");
  }
  return SnarkjsProver;
}

export async function verifyProof(vkey, publicSignals, proof) {
  return snarkjs.groth16.verify(vkey, publicSignals, proof, silentLogger);
}

export async function fullProve(input, wasmPath, zkeyPath) {
  return snarkjs.groth16.fullProve(input, wasmPath, zkeyPath, silentLogger);
}

export function writeWtnsFile(p, rawBin) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const n8 = 32;
  const nVars = rawBin.length / n8;
  const head = Buffer.alloc(12);
  head.write("wtns", 0, "ascii");
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(2, 8);
  const s1 = Buffer.alloc(12 + 8 + n8);
  s1.writeUInt32LE(1, 0);
  s1.writeBigUInt64LE(BigInt(8 + n8), 4);
  s1.writeUInt32LE(n8, 12);
  let prime = BN128_PRIME;
  for (let i = 0; i < n8; i++) {
    s1[16 + i] = Number(prime & 0xffn);
    prime >>= 8n;
  }
  s1.writeUInt32LE(nVars, 16 + n8);
  const s2head = Buffer.alloc(12);
  s2head.writeUInt32LE(2, 0);
  s2head.writeBigUInt64LE(BigInt(rawBin.length), 4);
  fs.writeFileSync(p, Buffer.concat([head, s1, s2head, Buffer.from(rawBin)]));
}

let calculatorFactory = null;
let calculatorKey = null;

export async function getCalculator(paths) {
  const key = `${paths.wasm}:${paths.witCalc}`;
  if (calculatorFactory && calculatorKey === key) return calculatorFactory;
  if (!fs.existsSync(paths.wasm)) throw new Error(`WASM not found: ${paths.wasm}`);
  if (!fs.existsSync(paths.witCalc)) throw new Error(`witCalc not found: ${paths.witCalc}`);
  fs.mkdirSync(paths.cacheDir, { recursive: true });
  const cjsPath = path.join(paths.cacheDir, "witness_calculator.cjs");
  fs.copyFileSync(paths.witCalc, cjsPath);
  calculatorFactory = await require(cjsPath)(fs.readFileSync(paths.wasm));
  calculatorKey = key;
  return calculatorFactory;
}

export async function generateWitnessBin(input, paths) {
  const wc = await getCalculator(paths);
  return wc.calculateBinWitness(input, 1);
}

export async function writeWitnessFile(input, wtnsPath, paths) {
  const witBin = await generateWitnessBin(input, paths);
  writeWtnsFile(wtnsPath, witBin);
  return witBin;
}

export const EXPECTED_PUBLIC_SIGNALS = 30;

/**
 * CanonicalProver: witness -> prove(backend) -> optional verify
 */
export async function proveCanonical(input, opts = {}) {
  const {
    resolveArtifacts,
    assertCoreArtifacts,
    artifactHashes,
  } = await import("./resolve-artifacts.mjs");

  const paths = opts.paths ?? resolveArtifacts(opts.pathOverrides);
  const scratchDir = opts.scratchDir ?? paths.scratchDir;
  const measure = opts.measure ?? false;
  const verify = opts.verify ?? true;
  const requestedBackend = opts.backend ?? getProverName();

  assertCoreArtifacts(paths);

  const prover = getProver(requestedBackend, { allowFallback: opts.allowFallback });
  const backend = prover.name;

  const timings = {};
  let t0 = Date.now();
  const wtnsPath = path.join(scratchDir, `prove-${Date.now()}.wtns`);
  fs.mkdirSync(scratchDir, { recursive: true });

  await writeWitnessFile(input, wtnsPath, paths);
  timings.witnessMs = Date.now() - t0;

  t0 = Date.now();
  const { proof, publicSignals } = await prover.prove(paths.zkey, wtnsPath, scratchDir);
  timings.proveMs = Date.now() - t0;

  if (publicSignals.length !== EXPECTED_PUBLIC_SIGNALS) {
    fs.rmSync(wtnsPath, { force: true });
    throw new Error(`Expected ${EXPECTED_PUBLIC_SIGNALS} public signals, got ${publicSignals.length}`);
  }

  let verified = null;
  if (verify) {
    t0 = Date.now();
    const vkey = JSON.parse(fs.readFileSync(paths.vkey, "utf8"));
    verified = await verifyProof(vkey, publicSignals, proof);
    timings.verifyMs = Date.now() - t0;
    if (verified !== true) {
      fs.rmSync(wtnsPath, { force: true });
      throw new Error("Local proof verification FAILED");
    }
  }

  if (opts.keepWtns !== true) fs.rmSync(wtnsPath, { force: true });

  timings.totalMs = timings.witnessMs + timings.proveMs + (timings.verifyMs ?? 0);

  return {
    proof,
    publicSignals,
    paths,
    backend,
    requestedBackend,
    verified,
    timings: measure ? timings : undefined,
    hashes: artifactHashes(paths),
  };
}
