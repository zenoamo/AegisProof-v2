// ============================================================================
// Separate Frozen Core static hashes from Groth16 regression execution.
// Regression PASS is exit 0 only after T1–T9 actually run.
// Missing production.zkey is NOT RUN (exit 2) and is not a pass.
// ============================================================================
import fs from "fs";
import {
  PRODUCTION_VKEY_HASH,
  resolveArtifacts,
  sha256File,
  sha256VkeyCeremony,
} from "./resolve-artifacts.mjs";

/** Full-file SHA-256 of the pinned v2 WASM. Matches the security-gate pin. */
export const PRODUCTION_WASM_SHA256 =
  "a0d3c53f3cdce624d5140874f0884b6b8075e701539978bdd55a826e41db60bd";

/** Full-file SHA-256 of the pinned v2 R1CS. Matches the security-gate pin. */
export const PRODUCTION_R1CS_SHA256 =
  "3d47226b06d707b1765d7bf35acd01966b9800b0f6fb77cfe084a775f0fa5599";

export const EXIT_REGRESSION_PASS = 0;
export const EXIT_REGRESSION_FAIL = 1;
export const EXIT_REGRESSION_NOT_RUN = 2;

/**
 * SHA-256 of WASM, R1CS, and the production verification key.
 * Does not read production.zkey and does not report regression status.
 * @param {ReturnType<typeof resolveArtifacts>} [paths]
 */
export function verifyFrozenCoreArtifactIntegrity(paths = resolveArtifacts()) {
  const errors = [];

  const checkRaw = (label, file, want) => {
    if (!file || !fs.existsSync(file)) {
      errors.push(`missing ${label}: ${file ?? "(unresolved)"}`);
      return;
    }
    const got = sha256File(file);
    if (got !== want) {
      errors.push(`${label} SHA-256 mismatch: got ${got}`);
    }
  };

  checkRaw("wasm", paths.wasm, PRODUCTION_WASM_SHA256);
  checkRaw("r1cs", paths.r1cs, PRODUCTION_R1CS_SHA256);

  if (!paths.vkey || !fs.existsSync(paths.vkey)) {
    errors.push(`missing vkey: ${paths.vkey ?? "(unresolved)"}`);
  } else {
    const raw = sha256File(paths.vkey);
    const ceremony = sha256VkeyCeremony(paths.vkey);
    if (raw !== PRODUCTION_VKEY_HASH) {
      errors.push(`vkey file SHA-256 mismatch: got ${raw}`);
    }
    if (ceremony !== PRODUCTION_VKEY_HASH) {
      errors.push(`vkey ceremony SHA-256 mismatch: got ${ceremony}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {true | false | null | "invalid"}
 */
export function claimedZkeyAvailable(env = process.env) {
  const raw = env.AEGIS_PRODUCTION_ZKEY_AVAILABLE;
  if (raw == null || String(raw).trim() === "") return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return "invalid";
}

/**
 * Whether T1–T9 are allowed to start.
 * A resolvable production.zkey is required to RUN.
 * AEGIS_PRODUCTION_ZKEY_AVAILABLE=true without that file fails closed.
 * A false or unset flag does not hide a resolvable zkey.
 *
 * @param {{ paths?: object, env?: NodeJS.ProcessEnv, claimed?: true | false | null | "invalid" }} [opts]
 */
export function classifyGroth16Regression(opts = {}) {
  let paths = opts.paths;
  if (!paths) {
    try {
      paths = resolveArtifacts();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        status: "FAIL",
        exitCode: EXIT_REGRESSION_FAIL,
        reason,
        countsAsPass: false,
        zkeyExists: false,
      };
    }
  }

  const zkeyExists = Boolean(paths.zkey && fs.existsSync(paths.zkey));
  const claimed = opts.claimed !== undefined ? opts.claimed : claimedZkeyAvailable(opts.env ?? process.env);

  if (claimed === "invalid") {
    return {
      status: "FAIL",
      exitCode: EXIT_REGRESSION_FAIL,
      reason: "AEGIS_PRODUCTION_ZKEY_AVAILABLE must be 'true' or 'false'",
      countsAsPass: false,
      zkeyExists,
    };
  }

  if (claimed === true && !zkeyExists) {
    return {
      status: "FAIL",
      exitCode: EXIT_REGRESSION_FAIL,
      reason: "AEGIS_PRODUCTION_ZKEY_AVAILABLE=true but production.zkey is unavailable",
      countsAsPass: false,
      zkeyExists: false,
    };
  }

  if (!zkeyExists) {
    return {
      status: "NOT_RUN",
      exitCode: EXIT_REGRESSION_NOT_RUN,
      reason: "production.zkey unavailable",
      countsAsPass: false,
      zkeyExists: false,
    };
  }

  const missing = ["wasm", "witCalc", "vkey", "input"].filter(
    (key) => !paths[key] || !fs.existsSync(paths[key])
  );
  if (missing.length) {
    return {
      status: "FAIL",
      exitCode: EXIT_REGRESSION_FAIL,
      reason: `production.zkey is present but regression inputs are missing: ${missing.join(", ")}`,
      countsAsPass: false,
      zkeyExists: true,
    };
  }

  return {
    status: "RUN",
    exitCode: null,
    reason:
      claimed === false
        ? "production.zkey is resolvable; AEGIS_PRODUCTION_ZKEY_AVAILABLE=false does not suppress execution"
        : "production.zkey is resolvable",
    countsAsPass: false,
    zkeyExists: true,
  };
}

/** Only an actual regression PASS counts as pass. NOT RUN does not. */
export function regressionCountsAsPass(status) {
  return status === "PASS";
}
