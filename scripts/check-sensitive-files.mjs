#!/usr/bin/env node
// ============================================================================
// Sensitive file boundary checker (AegisProof v2 GitHub governance)
// Usage: npm run check:sensitive-files [-- --strict]
// ============================================================================
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  CRITICAL_PATTERNS,
  classifyPath,
  evaluateScan,
  isExcluded,
  matchPatterns,
} from "./lib/sensitive-files-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST_PATH = path.join(ROOT, "scripts", "sensitive-files-allowlist.json");

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

function main() {
  const strict = process.argv.includes("--strict");
  const allowlist = loadAllowlist();
  const allowSet = new Set(allowlist.paths ?? []);

  const tracked = gitTrackedFiles();
  const critical = [];
  const migration = [];

  for (const f of tracked) {
    const c = classifyPath(f);
    critical.push(...c.critical);
    migration.push(...c.migration);
  }

  const wtCritical = scanWorkingTreePatterns().filter((h) => !tracked.includes(h.path) && !isExcluded(h.path));
  const allCritical = [...critical, ...wtCritical];
  const result = evaluateScan(allCritical, migration, allowSet, strict);

  console.log("Sensitive File Boundary Check");
  console.log(`  Tracked files scanned: ${tracked.length}`);
  console.log(`  Critical hits: ${allCritical.length}`);
  console.log(`  Migration hits: ${migration.length} (${result.migrationAllowlisted.length} allowlisted)`);

  for (const h of result.migrationAllowlisted) {
    console.log(`WARN allowlisted (migration debt): ${h.path} [${h.pattern}]`);
  }

  for (const h of result.migrationViolations) {
    console.error(`FAIL migration-sensitive (unallowlisted): ${h.path} [${h.pattern}] — ${h.desc}`);
  }

  for (const h of allCritical) {
    console.error(`FAIL critical-sensitive: ${h.path} [${h.pattern}] — ${h.desc}`);
  }

  if (strict) {
    for (const h of result.migrationAllowlisted) {
      console.error(`FAIL strict mode — allowlisted path still forbidden: ${h.path}`);
    }
  }

  if (!result.pass) {
    console.error("\nFAIL sensitive file boundary check");
    if (allowlist.note) console.error(`Allowlist note: ${allowlist.note}`);
    process.exit(1);
  }

  console.log("\nPASS sensitive file boundary check");
  if (result.migrationAllowlisted.length > 0) {
    console.log(`  (${result.migrationAllowlisted.length} migration-debt paths allowlisted — see ${path.relative(ROOT, ALLOWLIST_PATH)})`);
  }
}

main();
