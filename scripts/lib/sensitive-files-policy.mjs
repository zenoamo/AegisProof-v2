// ============================================================================
// Sensitive file policy (Phase 8.13 Task 7 — testable policy module)
// ============================================================================

/** Always fail — no allowlist. */
export const CRITICAL_PATTERNS = [
  { id: "env-file", re: /^\.env(\..+)?$/, desc: "environment secret file" },
  { id: "private-key-ext", re: /\.(key|private|secret|pem)$/i, desc: "private key material extension" },
  { id: "pqc-private-dir", re: /^artifacts\/provenance\/keys\//, desc: "PQC private key directory" },
  { id: "private-keys-dir", re: /(^|\/)private-keys\//, desc: "private-keys directory" },
  { id: "deployments-secrets", re: /^deployments\//, desc: "deployment credentials directory" },
  { id: "wallet-env", re: /mnemonic|wallet\.json|keystore/i, desc: "wallet credential pattern" },
];

/** Fail unless listed in allowlist (migration debt). */
export const MIGRATION_PATTERNS = [
  { id: "production-zkey", re: /production\.zkey$/i, desc: "production proving key binary" },
  { id: "ceremony-ptau", re: /\.ptau$/i, desc: "trusted setup ptau" },
  { id: "dev-zkey", re: /\/setup\/.*\.zkey$/i, desc: "development zkey in setup/" },
  { id: "witness-binary", re: /\.wtns$/i, desc: "witness binary" },
];

export const EXCLUDE_PREFIXES = ["rapidsnark/", "node_modules/", "circom/", ".git/"];

export function isExcluded(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return EXCLUDE_PREFIXES.some((p) => norm === p.slice(0, -1) || norm.startsWith(p));
}

export function matchPatterns(filePath, patterns, severity, source = "git-tracked") {
  const hits = [];
  const norm = filePath.replace(/\\/g, "/");
  for (const pat of patterns) {
    if (pat.re.test(norm)) {
      hits.push({ path: norm, pattern: pat.id, severity, desc: pat.desc, source });
    }
  }
  return hits;
}

/**
 * Classify a tracked path against policy.
 * @returns {{ critical: object[], migration: object[] }}
 */
export function classifyPath(filePath) {
  if (isExcluded(filePath)) return { critical: [], migration: [] };
  return {
    critical: matchPatterns(filePath, CRITICAL_PATTERNS, "critical"),
    migration: matchPatterns(filePath, MIGRATION_PATTERNS, "migration"),
  };
}

/**
 * Evaluate scan results against allowlist and strict mode.
 * @returns {{ pass: boolean, critical: object[], migrationViolations: object[], migrationAllowlisted: object[] }}
 */
export function evaluateScan(allCritical, migration, allowSet, strict = false) {
  const migrationViolations = migration.filter((h) => !allowSet.has(h.path));
  const migrationAllowlisted = migration.filter((h) => allowSet.has(h.path));
  const failCritical = allCritical.length > 0;
  const failMigration = migrationViolations.length > 0 || (strict && migrationAllowlisted.length > 0);
  return {
    pass: !failCritical && !failMigration,
    critical: allCritical,
    migrationViolations,
    migrationAllowlisted,
  };
}
