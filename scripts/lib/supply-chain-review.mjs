// ============================================================================
// Supply chain review helpers (Penetration Test PT-10)
// ============================================================================
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");

const SUSPICIOUS_SCRIPT_PATTERNS = [
  /^preinstall$/i,
  /^postinstall$/i,
  /^prepare$/i,
  /^prepublish/i,
];

const ALLOWED_INSTALL_SCRIPTS = new Set([
  "preinstall",
  "postinstall",
  "prepare",
]);

/** Scripts that must not invoke remote URLs or shell interpreters. */
const DANGEROUS_SCRIPT_SUBSTRINGS = [
  "curl ",
  "wget ",
  "bash -c",
  "powershell -",
  "eval(",
  "http://",
  "https://",
];

const UNEXPECTED_EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
]);

/**
 * @param {string} lockPath
 */
export function reviewPackageLock(lockPath = path.join(ROOT, "package-lock.json")) {
  const findings = [];
  if (!fs.existsSync(lockPath)) {
    return { ok: false, findings: [{ severity: "warn", message: "package-lock.json missing" }] };
  }
  const raw = fs.readFileSync(lockPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, findings: [{ severity: "critical", message: "package-lock.json invalid JSON" }] };
  }
  if (!parsed.lockfileVersion) {
    findings.push({ severity: "warn", message: "lockfileVersion missing" });
  }
  const digest = crypto.createHash("sha256").update(raw).digest("hex");
  return { ok: findings.every((f) => f.severity !== "critical"), findings, digest, packages: Object.keys(parsed.packages ?? {}).length };
}

/**
 * @param {object} pkg package.json object
 */
export function reviewPackageScripts(pkg) {
  const findings = [];
  const scripts = pkg.scripts ?? {};
  for (const [name, cmd] of Object.entries(scripts)) {
    if (typeof cmd !== "string") {
      findings.push({ severity: "critical", message: `script ${name} is not a string` });
      continue;
    }
    if (SUSPICIOUS_SCRIPT_PATTERNS.some((re) => re.test(name)) && !ALLOWED_INSTALL_SCRIPTS.has(name)) {
      findings.push({ severity: "warn", message: `lifecycle script present: ${name}` });
    }
    for (const bad of DANGEROUS_SCRIPT_SUBSTRINGS) {
      if (cmd.includes(bad)) {
        findings.push({ severity: "warn", message: `script ${name} contains suspicious pattern: ${bad.trim()}` });
      }
    }
  }
  return { ok: !findings.some((f) => f.severity === "critical"), findings };
}

/**
 * @param {string[]} tracked git-tracked relative paths
 */
export function findUnexpectedExecutables(tracked) {
  const findings = [];
  for (const rel of tracked) {
    const ext = path.extname(rel).toLowerCase();
    if (!UNEXPECTED_EXECUTABLE_EXTENSIONS.has(ext)) continue;
    if (rel.startsWith("node_modules/") || rel.startsWith("rapidsnark/")) continue;
    findings.push({ severity: "warn", message: `unexpected executable tracked: ${rel}` });
  }
  return { ok: !findings.some((f) => f.severity === "critical"), findings };
}

/**
 * Compare root package.json dependency keys against lockfile.
 * @param {object} pkg
 * @param {object} lock parsed package-lock
 */
export function reviewDependencyAlignment(pkg, lock) {
  const findings = [];
  const depKeys = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const lockPackages = lock.packages ?? {};
  for (const dep of depKeys) {
    const found = Object.keys(lockPackages).some((k) => k.endsWith(`node_modules/${dep}`) || k === `node_modules/${dep}`);
    if (!found) {
      findings.push({ severity: "warn", message: `dependency not in lockfile: ${dep}` });
    }
  }
  return { ok: findings.length === 0, findings };
}

/**
 * Full PT-10 review.
 */
export function runSupplyChainReview() {
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const lockReview = reviewPackageLock();
  const scriptReview = reviewPackageScripts(pkg);
  const tracked = gitTrackedFiles();
  const execReview = findUnexpectedExecutables(tracked);

  let depReview = { ok: true, findings: [] };
  if (fs.existsSync(path.join(ROOT, "package-lock.json"))) {
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
    depReview = reviewDependencyAlignment(pkg, lock);
  }

  const findings = [
    ...lockReview.findings,
    ...scriptReview.findings,
    ...execReview.findings,
    ...depReview.findings,
  ];

  return {
    ok: lockReview.ok && scriptReview.ok && execReview.ok && depReview.ok,
    lockDigest: lockReview.digest,
    packageCount: lockReview.packages,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

function gitTrackedFiles() {
  const r = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer", cwd: ROOT });
  if (r.status !== 0) return [];
  return r.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, "/"));
}
