#!/usr/bin/env node
// ============================================================================
// Sensitive file boundary checker (AegisProof v2 GitHub governance)
// Scans git-tracked and working-tree files for forbidden secret patterns.
// Usage: npm run check:sensitive-files [-- --strict]
//   --strict: fail on migration-allowlisted paths too (production.zkey etc.)
// ============================================================================
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Always fail — no allowlist. */
const CRITICAL_PATTERNS = [
  { id: "env-file", re: /^\.env(\..+)?$/, desc: "environment secret file" },
  { id: "private-key-ext", re: /\.(key|private|secret|pem)$/i, desc: "private key material extension" },
  { id: "pqc-private-dir", re: /^artifacts\/provenance\/keys\//, desc: "PQC private key directory" },
  { id: "private-keys-dir", re: /(^|\/)private-keys\//, desc: "private-keys directory" },
  { id: "deployments-secrets", re: /^deployments\//, desc: "deployment credentials directory" },
  { id: "wallet-env", re: /mnemonic|wallet\.json|keystore/i, desc: "wallet credential pattern" },
];

/** Fail unless listed in allowlist (migration debt). */
const MIGRATION_PATTERNS = [
  { id: "production-zkey", re: /production\.zkey$/i, desc: "production proving key binary" },
  { id: "ceremony-ptau", re: /\.ptau$/i, desc: "trusted setup ptau" },
  { id: "dev-zkey", re: /\/setup\/.*\.zkey$/i, desc: "development zkey in setup/" },
  { id: "witness-binary", re: /\.wtns$/i, desc: "witness binary" },
];

const ALLOWLIST_PATH = path.join(ROOT, "scripts", "sensitive-files-allowlist.json");

/** Vendored third-party trees — not AegisProof secrets (e.g. rapidsnark TLS test fixtures). */
const EXCLUDE_PREFIXES = ["rapidsnark/", "node_modules/", "circom/", ".git/"];

function isExcluded(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return EXCLUDE_PREFIXES.some((p) => norm === p.slice(0, -1) || norm.startsWith(p));
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return { paths: [], note: "" };
  return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
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

function scanWorkingTreePatterns() {
  const hits = [];
  const checkDir = (dir, prefix = "") => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = path.posix.join(prefix, name).replace(/\\/g, "/");
      if (name === "node_modules" || name === ".git" || name === "rapidsnark" || name === "circom") continue;
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        checkDir(abs, rel);
        continue;
      }
      for (const pat of CRITICAL_PATTERNS) {
        if (pat.re.test(rel) || pat.re.test(name)) {
          hits.push({ path: rel, pattern: pat.id, severity: "critical", desc: pat.desc, source: "working-tree" });
        }
      }
    }
  };
  checkDir(ROOT);
  return hits;
}

function matchPatterns(filePath, patterns, severity) {
  const hits = [];
  const norm = filePath.replace(/\\/g, "/");
  for (const pat of patterns) {
    if (pat.re.test(norm)) {
      hits.push({ path: norm, pattern: pat.id, severity, desc: pat.desc, source: "git-tracked" });
    }
  }
  return hits;
}

function main() {
  const strict = process.argv.includes("--strict");
  const allowlist = loadAllowlist();
  const allowSet = new Set(allowlist.paths ?? []);

  const tracked = gitTrackedFiles();
  const critical = [];
  const migration = [];

  for (const f of tracked) {
    if (isExcluded(f)) continue;
    critical.push(...matchPatterns(f, CRITICAL_PATTERNS, "critical"));
    migration.push(...matchPatterns(f, MIGRATION_PATTERNS, "migration"));
  }

  // Also scan untracked sensitive in working tree (critical only)
  const wtCritical = scanWorkingTreePatterns().filter((h) => !tracked.includes(h.path) && !isExcluded(h.path));

  const allCritical = [...critical, ...wtCritical];

  const migrationViolations = migration.filter((h) => !allowSet.has(h.path));
  const migrationAllowlisted = migration.filter((h) => allowSet.has(h.path));

  console.log("Sensitive File Boundary Check");
  console.log(`  Tracked files scanned: ${tracked.length}`);
  console.log(`  Critical hits: ${allCritical.length}`);
  console.log(`  Migration hits: ${migration.length} (${migrationAllowlisted.length} allowlisted)`);

  for (const h of migrationAllowlisted) {
    console.log(`WARN allowlisted (migration debt): ${h.path} [${h.pattern}]`);
  }

  for (const h of migrationViolations) {
    console.error(`FAIL migration-sensitive (unallowlisted): ${h.path} [${h.pattern}] — ${h.desc}`);
  }

  for (const h of allCritical) {
    console.error(`FAIL critical-sensitive: ${h.path} [${h.pattern}] — ${h.desc}`);
  }

  if (strict) {
    for (const h of migrationAllowlisted) {
      console.error(`FAIL strict mode — allowlisted path still forbidden: ${h.path}`);
    }
  }

  const failCritical = allCritical.length > 0;
  const failMigration = migrationViolations.length > 0 || (strict && migrationAllowlisted.length > 0);

  if (failCritical || failMigration) {
    console.error("\nFAIL sensitive file boundary check");
    if (allowlist.note) console.error(`Allowlist note: ${allowlist.note}`);
    process.exit(1);
  }

  console.log("\nPASS sensitive file boundary check");
  if (migrationAllowlisted.length > 0) {
    console.log(`  (${migrationAllowlisted.length} migration-debt paths allowlisted — see ${path.relative(ROOT, ALLOWLIST_PATH)})`);
  }
}

main();
