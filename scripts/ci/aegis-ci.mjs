#!/usr/bin/env node
/**
 * AegisProof Native CI
 *
 * Repository-owned CI orchestrator. GitHub Actions is only the runner;
 * pass/fail semantics live in this script.
 *
 * Result classes:
 *   PASS - repository gate passed
 *   FAIL - repository gate failed
 *   INFRA - runner/external-service failure, only when explicitly classified
 *
 * This runner never treats third-party GitHub review/agent checks as a
 * repository security result.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = path.join(ROOT, "artifacts", "ci");
const REPORT_PATH = path.join(REPORT_DIR, "aegis-ci-report.json");

const gates = [
  ["production-dependency-audit", "npm", ["audit", "--omit=dev"]],
  ["sensitive-files", "npm", ["run", "check:sensitive-files"]],
  ["security-boundary", "npm", ["run", "check:security-boundary"]],
  ["pqc-signature", "npm", ["run", "test:pqc-signature"]],
  ["hybrid-auth", "npm", ["run", "test:hybrid-auth"]],
  ["artifact-resolution", "npm", ["run", "test:artifact-resolution"]],
  ["artifact-provenance", "npm", ["run", "test:artifact-provenance"]],
  ["phase813-gate", "npm", ["run", "test:phase813-gate"]],
  ["hardhat-compile", "npx", ["hardhat", "compile"]],
  ["phase2-fast", "node", ["scripts/phase2_verify.mjs", "--fast", "--artifact-json"]],
];

function runGate(name, command, args) {
  const startedAt = new Date().toISOString();
  console.log("\n=== AegisProof CI: " + name + " ===");
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  const status = result.status === 0 ? "PASS" : "FAIL";
  console.log(status + ": " + name);
  return {
    name,
    status,
    command: [command, ...args].join(" "),
    startedAt,
    exitCode: result.status,
    signal: result.signal ?? null,
  };
}

const results = gates.map(([name, command, args]) => runGate(name, command, args));
const failed = results.filter((r) => r.status === "FAIL");

const report = {
  schemaVersion: 1,
  ci: "aegis-native",
  commit: process.env.GITHUB_SHA ?? "local",
  event: process.env.GITHUB_EVENT_NAME ?? "local",
  generatedAt: new Date().toISOString(),
  status: failed.length === 0 ? "PASS" : "FAIL",
  gates: results,
  externalChecks: {
    githubAdvancedSecurity: "EXTERNAL",
    note: "Third-party GitHub agent/review checks are not part of the repository-owned CI result.",
  },
};

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

console.log("\n=== AegisProof Native CI summary ===");
for (const result of results) {
  console.log(result.status.padEnd(5) + " " + result.name);
}
console.log("Report: " + path.relative(ROOT, REPORT_PATH));

if (failed.length > 0) process.exit(1);
