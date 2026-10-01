// ============================================================================
// VULN-004 regression — --live must verify committed manifest KMS layer
// Run: npm run test:penetration (included in penetration suite)
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(ROOT, "scripts", "verify-provenance-manifest.mjs");
const SOURCE = path.join(ROOT, "scripts", "verify-provenance-manifest.mjs");

const { loadManifest, DEFAULT_MANIFEST_PATH, preserveVerifiedKmsEnvelopes, createManifest } = await import(
  "../../scripts/lib/artifact-provenance.mjs"
);
const { BACKEND_VAULT_TRANSIT } = await import("../../scripts/lib/kms-signer.mjs");
const { buildSignMessage, entrySignPayload } = await import("../../scripts/lib/pqc-signature.mjs");
const { vaultTransitStubSignature } = await import("../../scripts/lib/kms-backends/vault-transit.mjs");
const { resolveArtifacts } = await import("../../scripts/lib/resolve-artifacts.mjs");
const {
  verifyEntryKms,
  verifyManifestKmsLayer,
  createProvenanceKmsSigner,
  validateKmsEnvelopeMetadata,
  rejectKmsStubInLiveMode,
} = await import("../../scripts/lib/kms-provenance.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

// T-EXP-004a: source inspection — live path invokes KMS layer before writeManifest
{
  const src = fs.readFileSync(SOURCE, "utf8");
  const liveStart = src.indexOf("if (live)");
  const liveEnd = src.indexOf("let manifest;", liveStart);
  assert.ok(liveStart >= 0 && liveEnd > liveStart, "live block exists");
  const liveBlock = src.slice(liveStart, liveEnd);
  ok(/verifyManifestKmsLayer\s*\(/.test(liveBlock), "T-EXP-004a: --live calls verifyManifestKmsLayer");
  const kmsIdx = liveBlock.indexOf("verifyManifestKmsLayer");
  const writeIdx = liveBlock.indexOf("writeManifest");
  ok(kmsIdx >= 0 && writeIdx > kmsIdx, "T-EXP-004a: KMS verify runs before writeManifest");
}

// T-EXP-004b: committed manifest with invalid KMS envelope → --live FAIL
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-exp004-"));
  try {
    const committed = loadManifest(DEFAULT_MANIFEST_PATH);
    const target = committed.entries.find((e) => e.present && e.sha256);
    assert.ok(target, "fixture entry with sha256");
    target.pqcSignatureEnvelope = {
      status: "signed",
      algorithmVersion: "ML-DSA-87",
      version: "v1",
      signature: "vault-stub-deadbeeffeedface0000000000000000",
      publicKeyId: "aegis-ci-mldsa87-v1",
      signedAt: new Date().toISOString(),
      kmsBackend: BACKEND_VAULT_TRANSIT,
      kmsLive: false,
      kmsStub: true,
    };
    const manifestPath = path.join(tmpDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(committed, null, 2));

    const prevMode = process.env.KMS_BACKEND_MODE;
    process.env.KMS_BACKEND_MODE = "stub";

    const run = spawnSync(process.execPath, [CLI, "--live", "--manifest", manifestPath], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env },
    });

    if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
    else process.env.KMS_BACKEND_MODE = prevMode;

    ok(run.status !== 0, "T-EXP-004b: --live FAIL when committed KMS envelope invalid");
    ok(
      /KMS/i.test(run.stderr ?? "") || /KMS/i.test(run.stdout ?? ""),
      "T-EXP-004b: output mentions KMS verification failure"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// T-EXP-004c: spy via verifyManifestKmsLayer — invoked when kmsBackend present
{
  const { verifyManifestKmsLayer } = await import("../../scripts/lib/kms-provenance.mjs");
  const committed = loadManifest(DEFAULT_MANIFEST_PATH);
  const withKms = structuredClone(committed);
  const entry = withKms.entries.find((e) => e.present && e.sha256);
  entry.pqcSignatureEnvelope = {
    ...entry.pqcSignatureEnvelope,
    kmsBackend: BACKEND_VAULT_TRANSIT,
    status: "unsigned",
    signature: null,
  };

  const hasKms = (withKms.entries ?? []).some((e) => e.pqcSignatureEnvelope?.kmsBackend);
  ok(hasKms, "T-EXP-004c: fixture manifest has kmsBackend entry");

  const noKms = structuredClone(committed);
  for (const e of noKms.entries ?? []) {
    if (e.pqcSignatureEnvelope?.kmsBackend) delete e.pqcSignatureEnvelope.kmsBackend;
  }
  const skipResult = await verifyManifestKmsLayer(noKms);
  ok(skipResult.ok && skipResult.verifiedCount === 0, "T-EXP-004c: no kmsBackend → skip with ok");

  // Invalid stub signature must not pass KMS layer (proves layer executes verify path)
  const bad = structuredClone(committed);
  const t = bad.entries.find((e) => e.present && e.sha256);
  t.pqcSignatureEnvelope = {
    status: "signed",
    algorithmVersion: "ML-DSA-87",
    version: "v1",
    signature: "vault-stub-invalid000000000000000000000",
    publicKeyId: "aegis-ci-mldsa87-v1",
    signedAt: new Date().toISOString(),
    kmsBackend: BACKEND_VAULT_TRANSIT,
    kmsStub: true,
  };
  const prevMode = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "stub";
  const badResult = await verifyManifestKmsLayer(bad);
  if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prevMode;
  ok(!badResult.ok, "T-EXP-004c: invalid KMS envelope rejected by verifyManifestKmsLayer");
  ok(badResult.errors.some((e) => e.includes("KMS verify failed")), "T-EXP-004c: KMS verification path executed");
}

function attachValidKmsStubEnvelope(entry) {
  const payload = entrySignPayload(entry);
  const msg = buildSignMessage(payload);
  const signature = vaultTransitStubSignature(msg);
  entry.pqcSignatureEnvelope = {
    status: "signed",
    algorithmVersion: "ML-DSA-87",
    version: "v1",
    signature,
    publicKeyId: "aegis-ci-mldsa87-v1",
    signedAt: new Date().toISOString(),
    kmsBackend: BACKEND_VAULT_TRANSIT,
    kmsLive: false,
    kmsStub: true,
  };
  return entry;
}

// T-EXP-004D: --live regeneration preserves a valid KMS envelope
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-exp004d-"));
  try {
    const committed = loadManifest(DEFAULT_MANIFEST_PATH);
    const target = committed.entries.find((e) => e.artifact === "production.zkey" && e.sha256);
    assert.ok(target, "production.zkey fixture");
    attachValidKmsStubEnvelope(target);
    const manifestPath = path.join(tmpDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(committed, null, 2));

    const prevMode = process.env.KMS_BACKEND_MODE;
    process.env.KMS_BACKEND_MODE = "stub";

    const run = spawnSync(process.execPath, [CLI, "--live", "--manifest", manifestPath], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env },
    });

    if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
    else process.env.KMS_BACKEND_MODE = prevMode;

    ok(run.status === 0, "T-EXP-004D: --live PASS with valid KMS envelope");
    const after = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const afterZkey = after.entries.find((e) => e.artifact === "production.zkey");
    ok(afterZkey?.pqcSignatureEnvelope?.kmsBackend === BACKEND_VAULT_TRANSIT, "T-EXP-004D: kmsBackend preserved");
    ok(afterZkey?.pqcSignatureEnvelope?.signature === target.pqcSignatureEnvelope.signature, "T-EXP-004D: signature preserved");
    ok(afterZkey?.pqcSignatureEnvelope?.kmsStub === true, "T-EXP-004D: kmsStub preserved");
    ok(afterZkey?.pqcSignatureEnvelope?.signedAt === target.pqcSignatureEnvelope.signedAt, "T-EXP-004D: signedAt preserved");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// T-EXP-004E: KMS envelope bound to a different artifact is rejected at verify time
{
  const committed = loadManifest(DEFAULT_MANIFEST_PATH);
  const zkey = committed.entries.find((e) => e.artifact === "production.zkey" && e.sha256);
  const vkey = committed.entries.find((e) => e.artifact === "production-vkey.json" && e.sha256);
  assert.ok(zkey && vkey, "zkey and vkey fixtures");
  attachValidKmsStubEnvelope(zkey);
  vkey.pqcSignatureEnvelope = structuredClone(zkey.pqcSignatureEnvelope);

  const { verifyManifestKmsLayer } = await import("../../scripts/lib/kms-provenance.mjs");
  const prevMode = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "stub";
  const cross = await verifyManifestKmsLayer(committed);
  if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prevMode;

  ok(!cross.ok, "T-EXP-004E: cross-artifact KMS envelope rejected");
  ok(cross.errors.some((e) => e.includes("production-vkey.json")), "T-EXP-004E: error names wrong artifact");
}

// T-EXP-004F: regenerated manifest cannot inherit envelope when artifact hash changed
{
  const paths = resolveArtifacts();
  const regenerated = createManifest(paths, { sign: false });
  const committed = structuredClone(regenerated);
  const zkeyCommitted = committed.entries.find((e) => e.artifact === "production.zkey");
  attachValidKmsStubEnvelope(zkeyCommitted);

  const zkeyRegenerated = regenerated.entries.find((e) => e.artifact === "production.zkey");
  zkeyRegenerated.sha256 = "f".repeat(64);
  zkeyRegenerated.classicalHash.digest = zkeyRegenerated.sha256;

  const merged = preserveVerifiedKmsEnvelopes(regenerated, committed);
  const mergedZkey = merged.entries.find((e) => e.artifact === "production.zkey");
  ok(mergedZkey?.pqcSignatureEnvelope?.status === "unsigned", "T-EXP-004F: hash change drops KMS envelope");
  ok(!mergedZkey?.pqcSignatureEnvelope?.kmsBackend, "T-EXP-004F: kmsBackend not inherited after hash change");
}

// T-EXP-004G: invalid/malformed KMS envelope remains rejected on --live path
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-exp004g-"));
  try {
    const committed = loadManifest(DEFAULT_MANIFEST_PATH);
    const target = committed.entries.find((e) => e.present && e.sha256);
    target.pqcSignatureEnvelope = {
      status: "signed",
      algorithmVersion: "ML-DSA-87",
      version: "v1",
      signature: "vault-stub-malformed000000000000000000",
      publicKeyId: "aegis-ci-mldsa87-v1",
      signedAt: new Date().toISOString(),
      kmsBackend: BACKEND_VAULT_TRANSIT,
      kmsStub: true,
    };
    const manifestPath = path.join(tmpDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(committed, null, 2));

    const prevMode = process.env.KMS_BACKEND_MODE;
    process.env.KMS_BACKEND_MODE = "stub";
    const run = spawnSync(process.execPath, [CLI, "--live", "--manifest", manifestPath], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env },
    });
    if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
    else process.env.KMS_BACKEND_MODE = prevMode;

    ok(run.status !== 0, "T-EXP-004G: malformed KMS envelope rejected on --live");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ============================================================================
// VULN-001 regression — KMS stub metadata trust hardening
// ============================================================================

function sampleKmsEntry() {
  const committed = loadManifest(DEFAULT_MANIFEST_PATH);
  const entry = committed.entries.find((e) => e.artifact === "production.zkey" && e.sha256);
  assert.ok(entry, "production.zkey fixture");
  return structuredClone(entry);
}

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesignature`;
}

function withLiveOidcEnv(fn) {
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
    VAULT_TRANSIT_TOKEN: process.env.VAULT_TRANSIT_TOKEN,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    KMS_OIDC_EXPECT_REPOSITORY: process.env.KMS_OIDC_EXPECT_REPOSITORY,
    KMS_OIDC_EXPECT_OWNER: process.env.KMS_OIDC_EXPECT_OWNER,
    KMS_OIDC_EXPECT_REF: process.env.KMS_OIDC_EXPECT_REF,
    KMS_OIDC_EXPECT_WORKFLOW: process.env.KMS_OIDC_EXPECT_WORKFLOW,
    KMS_OIDC_EXPECT_ENVIRONMENT: process.env.KMS_OIDC_EXPECT_ENVIRONMENT,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.VAULT_ADDR = "http://vault.test:8200";
  delete process.env.VAULT_TOKEN;
  delete process.env.VAULT_TRANSIT_TOKEN;
  process.env.VAULT_JWT_ROLE = "ci-provenance-signer";
  process.env.VAULT_OIDC_JWT = makeJwt({
    repository: "zenoamo/AegisProof-v2",
    repository_owner: "zenoamo",
    ref: "refs/tags/v2.0.1",
    workflow: "Release",
    environment: "release-signing",
  });
  process.env.KMS_OIDC_EXPECT_REPOSITORY = "zenoamo/AegisProof-v2";
  process.env.KMS_OIDC_EXPECT_OWNER = "zenoamo";
  process.env.KMS_OIDC_EXPECT_REF = "refs/tags/v*";
  process.env.KMS_OIDC_EXPECT_WORKFLOW = "Release";
  process.env.KMS_OIDC_EXPECT_ENVIRONMENT = "release-signing";
  return fn(prev);
}

// T-EXP-001A: live + kmsStub=true → reject
{
  const prevMode = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "live";
  const entry = sampleKmsEntry();
  attachValidKmsStubEnvelope(entry);
  const signer = createProvenanceKmsSigner();
  const result = await verifyEntryKms(entry, signer);
  if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prevMode;
  ok(!result.ok, "T-EXP-001A: live mode rejects kmsStub=true");
  ok(result.code === "KMS_STUB_FORBIDDEN_IN_LIVE_MODE", "T-EXP-001A: forbidden code");
}

// T-EXP-001B: live + kmsStub=true + valid vault-stub signature → reject
{
  const prevMode = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "live";
  const entry = sampleKmsEntry();
  attachValidKmsStubEnvelope(entry);
  ok(entry.pqcSignatureEnvelope.signature.startsWith("vault-stub-"), "T-EXP-001B: valid vault-stub signature");
  const signer = createProvenanceKmsSigner();
  const result = await verifyEntryKms(entry, signer);
  if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prevMode;
  ok(!result.ok, "T-EXP-001B: live mode rejects valid vault-stub signature");
  ok(result.code === "KMS_STUB_FORBIDDEN_IN_LIVE_MODE", "T-EXP-001B: forbidden code");
}

// T-EXP-001C: stub + kmsStub=true → existing behavior preserved
{
  const prevMode = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "stub";
  const entry = sampleKmsEntry();
  attachValidKmsStubEnvelope(entry);
  const signer = createProvenanceKmsSigner();
  const result = await verifyEntryKms(entry, signer);
  if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prevMode;
  ok(result.ok, "T-EXP-001C: stub mode accepts valid kmsStub envelope");
}

// T-EXP-001D: live + kmsStub=false + forged signature → reject
{
  await withLiveOidcEnv(async (prev) => {
    const { setKmsFetchForTests, resetKmsFetchForTests } = await import(
      "../../scripts/lib/kms-backends/http-fetch.mjs"
    );
    const { clearVaultAuthCacheForTests } = await import("../../scripts/lib/kms-backends/vault-auth.mjs");
    clearVaultAuthCacheForTests();
    setKmsFetchForTests(async (url) => {
      if (String(url).includes("/login")) {
        return new Response(
          JSON.stringify({ auth: { client_token: "mock-vault-token", lease_duration: 3600 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/transit/verify/")) {
        return new Response(JSON.stringify({ data: { valid: false } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const entry = sampleKmsEntry();
    entry.pqcSignatureEnvelope = {
      status: "signed",
      algorithmVersion: "ML-DSA-87",
      version: "v1",
      signature: "vault:v1:forged-signature",
      publicKeyId: "aegis-ci-mldsa87-v1",
      signedAt: new Date().toISOString(),
      kmsBackend: BACKEND_VAULT_TRANSIT,
      kmsLive: true,
      kmsStub: false,
    };
    const signer = createProvenanceKmsSigner();
    const result = await verifyEntryKms(entry, signer);
    ok(!result.ok, "T-EXP-001D: live mode rejects forged non-stub signature");
    ok(
      result.error?.includes("vault transit verify rejected") || result.error?.includes("rejected"),
      "T-EXP-001D: vault verify rejection"
    );

    resetKmsFetchForTests();
    clearVaultAuthCacheForTests();
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

// T-EXP-001E: contradictory metadata kmsStub=true + kmsLive=true → reject
{
  const entry = sampleKmsEntry();
  attachValidKmsStubEnvelope(entry);
  entry.pqcSignatureEnvelope.kmsLive = true;
  const meta = validateKmsEnvelopeMetadata(entry.pqcSignatureEnvelope);
  ok(!meta.ok, "T-EXP-001E: contradictory metadata rejected");
  ok(meta.code === "KMS_ENVELOPE_METADATA_CONFLICT", "T-EXP-001E: conflict code");
  const prevMode = process.env.KMS_BACKEND_MODE;
  process.env.KMS_BACKEND_MODE = "stub";
  const signer = createProvenanceKmsSigner();
  const result = await verifyEntryKms(entry, signer);
  if (prevMode === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prevMode;
  ok(!result.ok, "T-EXP-001E: verifyEntryKms rejects contradictory metadata");
  ok(result.code === "KMS_ENVELOPE_METADATA_CONFLICT", "T-EXP-001E: verify path conflict code");
}

// T-EXP-001F: legitimate live KMS envelope (mocked Vault) → PASS
{
  await withLiveOidcEnv(async (prev) => {
    const { setKmsFetchForTests, resetKmsFetchForTests } = await import(
      "../../scripts/lib/kms-backends/http-fetch.mjs"
    );
    const { clearVaultAuthCacheForTests } = await import("../../scripts/lib/kms-backends/vault-auth.mjs");
    clearVaultAuthCacheForTests();
    setKmsFetchForTests(async (url) => {
      if (String(url).includes("/login")) {
        return new Response(
          JSON.stringify({ auth: { client_token: "mock-vault-token", lease_duration: 3600 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/transit/verify/")) {
        return new Response(JSON.stringify({ data: { valid: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const entry = sampleKmsEntry();
    entry.pqcSignatureEnvelope = {
      status: "signed",
      algorithmVersion: "ML-DSA-87",
      version: "v1",
      signature: "vault:v1:mock-live-sig",
      publicKeyId: "aegis-ci-mldsa87-v1",
      signedAt: new Date().toISOString(),
      kmsBackend: BACKEND_VAULT_TRANSIT,
      kmsLive: true,
      kmsStub: false,
    };
    const signer = createProvenanceKmsSigner();
    const result = await verifyEntryKms(entry, signer);
    ok(result.ok, "T-EXP-001F: legitimate live KMS envelope accepted");
    ok(rejectKmsStubInLiveMode(entry.pqcSignatureEnvelope).ok, "T-EXP-001F: live stub policy allows live envelope");

    resetKmsFetchForTests();
    clearVaultAuthCacheForTests();
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

console.log(`\nPROVENANCE LIVE KMS: ${passed} checks PASS`);
