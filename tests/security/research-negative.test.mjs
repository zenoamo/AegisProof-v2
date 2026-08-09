// ============================================================================
// Research Expansion — additive negative security tests (Phase E)
// Run: node --test tests/security/research-negative.test.mjs
// Does NOT weaken existing penetration or remediation test semantics.
// ============================================================================
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const {
  createManifest,
  verifyManifest,
  verifyManifestIntegrity,
  loadManifest,
} = await import("../../scripts/lib/artifact-provenance.mjs");

const {
  PRODUCTION_ZKEY_HASH,
  resolveArtifacts,
} = await import("../../scripts/lib/resolve-artifacts.mjs");

const {
  createPqcSignatureEnvelope,
  verifyEnvelope,
  entrySignPayload,
  generateKeypair,
} = await import("../../scripts/lib/pqc-signature.mjs");

const { validateEnvelopeKeyReference } = await import("../../scripts/lib/public-key-registry.mjs");

const {
  validateOidcClaimBindings,
  decodeJwtPayload,
  VaultAuthError,
} = await import("../../scripts/lib/kms-backends/vault-auth.mjs");

const { rejectKmsStubInLiveMode } = await import("../../scripts/lib/kms-provenance.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(snapshot)) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

// T-RES-001: Manifest replay — stale artifact hash
{
  const paths = resolveArtifacts();
  const fresh = createManifest(paths, { sign: false });
  const stale = JSON.parse(JSON.stringify(fresh));
  const zkeyIdx = stale.entries.findIndex((e) => e.artifact === "production.zkey");
  if (zkeyIdx >= 0) {
    stale.entries[zkeyIdx].sha256 = "0".repeat(64);
  }
  const result = verifyManifest(stale, { allowMissingOptional: true });
  ok(!result.ok, "T-RES-001: stale zkey hash rejected");
  ok(result.errors.some((e) => e.includes("hash mismatch")), "T-RES-001: hash mismatch reported");
}

// T-RES-002: Signature substitution across entries
{
  const { secretKey, publicKeyHex } = generateKeypair();
  const entryA = {
    artifact: "production.zkey",
    path: "crypto-artifacts/phase4/production.zkey",
    sha256: PRODUCTION_ZKEY_HASH,
    size: 1,
    version: "v2",
    source: "test",
    present: true,
  };
  const entryB = { ...entryA, artifact: "production-vkey.json", sha256: "b".repeat(64) };
  const payloadA = entrySignPayload(entryA);
  const payloadB = entrySignPayload(entryB);
  const envelopeA = createPqcSignatureEnvelope(payloadA, { privateKey: secretKey, publicKeyHex });
  const cross = verifyEnvelope(payloadB, envelopeA);
  ok(!cross.ok, "T-RES-002: cross-entry signature rejected");
}

// T-RES-003: Registry key mismatch
{
  const { secretKey, publicKeyHex } = generateKeypair();
  const entry = {
    artifact: "production.zkey",
    path: "x",
    sha256: PRODUCTION_ZKEY_HASH,
    size: 1,
    version: "v2",
    source: "test",
    present: true,
  };
  const payload = entrySignPayload(entry);
  const envelope = createPqcSignatureEnvelope(payload, { privateKey: secretKey, publicKeyHex });
  envelope.publicKeyId = "nonexistent-research-key-id";
  const ref = validateEnvelopeKeyReference(envelope);
  ok(!ref.ok, "T-RES-003: unknown registry keyId rejected");
}

// T-RES-004: OIDC claim spoof (wrong repository)
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    KMS_OIDC_EXPECT_REPOSITORY: process.env.KMS_OIDC_EXPECT_REPOSITORY,
    KMS_OIDC_EXPECT_OWNER: process.env.KMS_OIDC_EXPECT_OWNER,
    KMS_OIDC_EXPECT_REF: process.env.KMS_OIDC_EXPECT_REF,
    KMS_OIDC_EXPECT_WORKFLOW: process.env.KMS_OIDC_EXPECT_WORKFLOW,
    KMS_OIDC_EXPECT_ENVIRONMENT: process.env.KMS_OIDC_EXPECT_ENVIRONMENT,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.KMS_OIDC_EXPECT_REPOSITORY = "zenoamo/AegisProof-v2";
  process.env.KMS_OIDC_EXPECT_OWNER = "zenoamo";
  process.env.KMS_OIDC_EXPECT_REF = "refs/tags/v*";
  process.env.KMS_OIDC_EXPECT_WORKFLOW = "Release";
  process.env.KMS_OIDC_EXPECT_ENVIRONMENT = "release-signing";
  const jwt = makeJwt({
    repository: "attacker/evil-repo",
    repository_owner: "attacker",
    ref: "refs/tags/v9.9.9",
    workflow: "Release",
    environment: "release-signing",
  });
  try {
    assert.throws(
      () => validateOidcClaimBindings(decodeJwtPayload(jwt)),
      (err) => {
        ok(err instanceof VaultAuthError, "T-RES-004: VaultAuthError on spoofed repo");
        ok(err.code === "OIDC_CLAIM_REJECTED", "T-RES-004: OIDC_CLAIM_REJECTED");
        return true;
      }
    );
    passed += 2;
  } finally {
    restoreEnv(prev);
  }
}

// T-RES-005: Stub/live mode confusion
{
  const prev = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "live";
  try {
    const result = rejectKmsStubInLiveMode({ kmsStub: true, signature: "vault-stub-abc" });
    ok(!result.ok, "T-RES-005: stub envelope rejected in live mode");
    ok(result.code === "KMS_STUB_FORBIDDEN_IN_LIVE_MODE", "T-RES-005: forbidden code");
  } finally {
    if (prev === undefined) delete process.env.KMS_BACKEND_MODE;
    else process.env.KMS_BACKEND_MODE = prev;
  }
}

// T-RES-006: TEE evidence corruption — delegate to offline verification suite
{
  const teeTest = path.join(ROOT, "tee/tests/offline-verification.test.ts");
  ok(fs.existsSync(teeTest), "T-RES-006: offline verification test file exists");
  const r = spawnSync("npx", ["tsx", teeTest], { cwd: ROOT, stdio: "pipe", shell: true });
  ok(r.status === 0, "T-RES-006: offline TEE verification suite PASS (includes negative vectors)");
}

// T-RES-007: Release metadata tamper
{
  const committed = loadManifest();
  const tampered = JSON.parse(JSON.stringify(committed));
  tampered.pinnedProductionHashes.zkeyHash = "f".repeat(64);
  const result = verifyManifestIntegrity(tampered);
  ok(!result.ok, "T-RES-007: pinned hash tamper rejected");
  ok(result.errors.some((e) => e.includes("zkeyHash")), "T-RES-007: zkeyHash error reported");
}

// T-RES-008: Dependency substitution (production elliptic absence)
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  ok(!("circomlibjs" in (pkg.dependencies ?? {})), "T-RES-008: circomlibjs not in production deps");
  const ls = spawnSync("npm", ["ls", "elliptic", "--omit=dev"], { cwd: ROOT, encoding: "utf8", shell: true });
  const out = `${ls.stdout ?? ""}${ls.stderr ?? ""}`;
  const hasElliptic = /elliptic@/.test(out) && !/empty/i.test(out);
  ok(!hasElliptic, "T-RES-008: elliptic absent from production tree");
}

console.log(`\nRESEARCH NEGATIVE TESTS: ${passed} checks PASS`);
