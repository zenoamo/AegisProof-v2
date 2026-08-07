// ============================================================================
// Penetration Test — Repository boundary, authorization, CI, frozen core, supply chain
// PT-01, PT-07, PT-08, PT-09, PT-10
// Run: npm run test:penetration (via run-penetration.mjs)
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const {
  classifyPath,
  evaluateScan,
  CRITICAL_PATTERNS,
} = await import("../../scripts/lib/sensitive-files-policy.mjs");

const {
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  resolveArtifacts,
  sha256File,
  sha256VkeyCeremony,
} = await import("../../scripts/lib/resolve-artifacts.mjs");

const { runSupplyChainReview } = await import("../../scripts/lib/supply-chain-review.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

function skip(name, reason) {
  console.log(`SKIP ${name}: ${reason}`);
}

// --- PT-01: Repository Boundary Escape Test ---
const criticalSamples = [
  [".env", "env-file"],
  ["secrets/operator.pem", "private-key-ext"],
  ["artifacts/provenance/keys/ci.key.json", "pqc-private-dir"],
  ["deployments/mainnet.json", "deployments-secrets"],
];

for (const [sample, patternId] of criticalSamples) {
  const r = classifyPath(sample);
  ok(r.critical.some((h) => h.pattern === patternId), `PT-01: ${sample} classified CRITICAL`);
}

const migrationZkey = classifyPath("crypto-artifacts/phase4/production.zkey");
ok(migrationZkey.critical.length === 0, "PT-01: production.zkey not CRITICAL (migration tier)");

const simulatedCritical = [{ path: ".env", pattern: "env-file", severity: "critical", desc: "test", source: "test" }];
const ev = evaluateScan(simulatedCritical, [], new Set(), false);
ok(!ev.pass && ev.critical.length === 1, "PT-01: CRITICAL file causes FAIL");

const cleanEv = evaluateScan([], [], new Set(), false);
ok(cleanEv.pass, "PT-01: no critical/migration violations PASS");

// Live git-tracked scan (no CRITICAL outside exclusions)
const gitLs = spawnSync("git", ["ls-files"], { encoding: "utf8", cwd: ROOT });
if (gitLs.status === 0) {
  const tracked = gitLs.stdout.split(/\r?\n/).filter(Boolean);
  const liveCritical = [];
  for (const f of tracked) {
    liveCritical.push(...classifyPath(f.replace(/\\/g, "/")).critical);
  }
  ok(liveCritical.length === 0, `PT-01: live git-tracked scan has 0 CRITICAL (${tracked.length} files)`);
} else {
  skip("PT-01: live git-tracked scan", "git ls-files unavailable");
}

// --- PT-07: Authorization Boundary (AegisShield integration) ---
const shieldPenPath = path.join(ROOT, "verification/tests/integration/AegisShield.penetration.ts");
ok(fs.existsSync(shieldPenPath), "PT-07: AegisShield penetration test file exists");

const shieldSrc = fs.readFileSync(shieldPenPath, "utf8");
const authScenarios = [
  ["unauthorized session", /unauthorized session/i],
  ["replay", /replay/i],
  ["nullifier", /nullifier/i],
  ["purpose mismatch", /purpose/i],
  ["session spoofing", /spoofing/i],
  ["deactivated session", /deactiv/i],
  ["unregistered session", /unregistered/i],
];

for (const [label, re] of authScenarios) {
  ok(re.test(shieldSrc), `PT-07: AegisShield covers ${label}`);
}

const ptCaseCount = (shieldSrc.match(/PT-\d+:/g) ?? []).length;
ok(ptCaseCount >= 12, `PT-07: AegisShield penetration has >=12 cases (found ${ptCaseCount})`);

// Optional live Hardhat run (requires build proofs + compile)
const proofPath = path.join(ROOT, "build/proofs/proof_29.json");
if (fs.existsSync(proofPath) && process.env.PT_RUN_SHIELD_LIVE === "1") {
  const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const live = spawnSync(
    process.execPath,
    [tsxCli, "--test", shieldPenPath],
    { cwd: ROOT, encoding: "utf8", timeout: 300_000 }
  );
  ok(live.status === 0, "PT-07: AegisShield live penetration PASS");
} else {
  skip("PT-07: AegisShield live Hardhat run", "set PT_RUN_SHIELD_LIVE=1 to enable (structural checks PASS)");
}

// --- PT-08: CI Security Gate Test ---
const wfPath = path.join(ROOT, ".github/workflows/aegis_repro_ci.yml");
const wf = fs.readFileSync(wfPath, "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

ok(wf.includes("security-boundary-check"), "PT-08: security-boundary-check job exists");
ok(wf.includes("check:sensitive-files"), "PT-08: sensitive file scan in CI");
ok(wf.includes("verify:provenance"), "PT-08: provenance verification in CI");
ok(wf.includes("test:prover-compat"), "PT-08: prover regression (frozen core) in CI");
ok(wf.includes("test:phase813-gate") || wf.includes("test:penetration"), "PT-08: regression/penetration gate in CI");
ok(typeof pkg.scripts["check:sensitive-files"] === "string", "PT-08: check:sensitive-files npm script");
ok(typeof pkg.scripts["verify:provenance"] === "string", "PT-08: verify:provenance npm script");
ok(typeof pkg.scripts["test:phase813-gate"] === "string", "PT-08: test:phase813-gate npm script");

// --- PT-09: Frozen Core Integrity Test ---
const FROZEN_PREFIXES = ["circuits/", "protocol/", "packages/sdk/", "tee/"];
const FROZEN_FILES = [
  "protocol/contracts/Groth16VerifierV2Production.sol",
  "scripts/prover-contracts/Groth16VerifierV2Production.sol",
];

const diff = spawnSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8", cwd: ROOT });
if (diff.status === 0) {
  const changed = diff.stdout.split(/\r?\n/).filter(Boolean).map((p) => p.replace(/\\/g, "/"));
  for (const prefix of FROZEN_PREFIXES) {
    const hits = changed.filter((p) => p.startsWith(prefix));
    ok(hits.length === 0, `PT-09: no diff under ${prefix} (${hits.length} files)`);
  }
  for (const f of FROZEN_FILES) {
    ok(!changed.includes(f), `PT-09: frozen file unchanged: ${f}`);
  }
} else {
  skip("PT-09: git diff frozen paths", "git diff unavailable");
}

const paths = resolveArtifacts();
if (fs.existsSync(paths.zkey)) {
  ok(sha256File(paths.zkey) === PRODUCTION_ZKEY_HASH, "PT-09: production.zkey hash pinned");
} else {
  skip("PT-09: production.zkey hash", "zkey absent locally");
}
if (fs.existsSync(paths.vkey)) {
  ok(sha256VkeyCeremony(paths.vkey) === PRODUCTION_VKEY_HASH, "PT-09: VK ceremony hash pinned");
} else {
  skip("PT-09: VK ceremony hash", "vkey absent locally");
}

const baselineProof = path.join(ROOT, "artifacts/phase4/reports/production_proof_baseline.json");
if (fs.existsSync(baselineProof)) {
  const baseline = JSON.parse(fs.readFileSync(baselineProof, "utf8"));
  const signals = baseline.publicSignals ?? baseline.signals ?? [];
  ok(signals.length === 30, "PT-09: baseline publicSignals count is 30");
} else {
  skip("PT-09: publicSignals baseline", "production_proof_baseline.json absent");
}

// --- PT-10: Dependency / Supply Chain Review ---
const supply = runSupplyChainReview();
ok(supply.lockDigest?.length === 64, "PT-10: package-lock SHA-256 digest computed");
ok(!supply.findings.some((f) => f.severity === "critical"), "PT-10: no critical supply-chain findings");
ok(supply.packageCount > 0, "PT-10: lockfile packages enumerated");

const reportPath = path.join(ROOT, "benchmarks/reports/supply-chain-review.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(supply, null, 2), "utf8");
ok(fs.existsSync(reportPath), "PT-10: supply-chain review report generated");

console.log(`\nPENETRATION BOUNDARY: ${passed} checks PASS`);
