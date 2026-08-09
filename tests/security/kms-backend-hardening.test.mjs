// ============================================================================
// KMS backend hardening tests (Phase 8.14 Task 3)
// Run: npm run test:kms-signer
// ============================================================================
import assert from "node:assert/strict";

const {
  createSigner,
  signPayload,
  verifySignedPayload,
  KmsSecurityError,
  BACKEND_VAULT_TRANSIT,
  BACKEND_CLOUD_HSM,
  SIGNER_ROLE_PROVENANCE,
} = await import("../../scripts/lib/kms-signer.mjs");

const { entrySignPayload } = await import("../../scripts/lib/pqc-signature.mjs");
const {
  validateVaultTransitEnv,
  validateCloudHsmEnv,
  validateTransitKeyName,
  validateTransitMount,
} = await import("../../scripts/lib/kms-backends/env.mjs");
const { vaultTransitSign, vaultTransitVerify } = await import("../../scripts/lib/kms-backends/vault-transit.mjs");
const {
  setKmsFetchForTests,
  resetKmsFetchForTests,
  setKmsFetchTimeoutForTests,
  redactKmsSecrets,
} = await import("../../scripts/lib/kms-backends/http-fetch.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

function restoreEnv(prev) {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function basePayload(suffix) {
  return entrySignPayload({
    artifact: `task3-${suffix}.wasm`,
    path: `artifacts/task3-${suffix}.wasm`,
    sha256: "a".repeat(64),
    size: 1,
    version: "v2",
    source: "test",
  });
}

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesignature`;
}

function setupLiveOidcVaultEnv() {
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
}

// T-KMS-10: live mode requires Vault config — no stub fallback
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE, VAULT_ADDR: process.env.VAULT_ADDR, VAULT_TOKEN: process.env.VAULT_TOKEN };
  delete process.env.VAULT_ADDR;
  delete process.env.VAULT_TOKEN;
  process.env.KMS_BACKEND_MODE = "live";

  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });

  await assert.rejects(() => signPayload(signer, basePayload("live-no-vault")), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-10: live vault missing config throws");
    ok(err.code === "VAULT_NOT_CONFIGURED", "T-KMS-10: VAULT_NOT_CONFIGURED code");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-10: live mode forbids vault stub fallback");

  restoreEnv(prev);
}

// T-KMS-11: live mode requires cloud-hsm config
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
  };
  process.env.KMS_BACKEND_MODE = "live";
  delete process.env.CLOUD_HSM_PROVIDER;

  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });

  await assert.rejects(() => signPayload(signer, basePayload("live-no-cloud")), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-11: live cloud missing config throws");
    ok(err.code === "CLOUD_HSM_NOT_CONFIGURED", "T-KMS-11: CLOUD_HSM_NOT_CONFIGURED code");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-11: live mode forbids cloud stub fallback");

  restoreEnv(prev);
}

// T-KMS-12: Vault auth failure (403)
{
  const prev = {
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
    VAULT_TRANSIT_TOKEN: process.env.VAULT_TRANSIT_TOKEN,
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    KMS_OIDC_EXPECT_REPOSITORY: process.env.KMS_OIDC_EXPECT_REPOSITORY,
    KMS_OIDC_EXPECT_OWNER: process.env.KMS_OIDC_EXPECT_OWNER,
    KMS_OIDC_EXPECT_REF: process.env.KMS_OIDC_EXPECT_REF,
    KMS_OIDC_EXPECT_WORKFLOW: process.env.KMS_OIDC_EXPECT_WORKFLOW,
    KMS_OIDC_EXPECT_ENVIRONMENT: process.env.KMS_OIDC_EXPECT_ENVIRONMENT,
  };
  process.env.VAULT_ADDR = "http://vault.test:8200";
  process.env.KMS_BACKEND_MODE = "live";
  setupLiveOidcVaultEnv();

  setKmsFetchForTests(async (url) => {
    if (String(url).includes("/login")) {
      return new Response(
        JSON.stringify({ auth: { client_token: "mock-vault-token", lease_duration: 3600 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ errors: ["permission denied"] }), { status: 403 });
  });

  await assert.rejects(
    () => vaultTransitSign({ keyName: "aegis-ci-mldsa87-v1", message: new TextEncoder().encode("x") }),
    (err) => {
      ok(err.code === "VAULT_AUTH_FAILED", "T-KMS-12: VAULT_AUTH_FAILED on 403");
      return true;
    }
  );
  passed++;
  console.log("PASS T-KMS-12: vault auth failure handling");

  resetKmsFetchForTests();
  restoreEnv(prev);
}

// T-KMS-13: Vault HTTP timeout
{
  const prev = { VAULT_ADDR: process.env.VAULT_ADDR, VAULT_TOKEN: process.env.VAULT_TOKEN };
  process.env.VAULT_ADDR = "http://vault.test:8200";
  process.env.VAULT_TOKEN = "placeholder-token-not-real";

  setKmsFetchTimeoutForTests(5);
  setKmsFetchForTests(() => new Promise(() => {}));

  await assert.rejects(
    () => vaultTransitSign({ keyName: "aegis-ci-mldsa87-v1", message: new TextEncoder().encode("x") }),
    (err) => {
      ok(err.code === "VAULT_TIMEOUT", "T-KMS-13: VAULT_TIMEOUT code");
      return true;
    }
  );
  passed++;
  console.log("PASS T-KMS-13: vault timeout handling");

  resetKmsFetchForTests();
  restoreEnv(prev);
}

// T-KMS-14: Vault malformed sign response
{
  const prev = { VAULT_ADDR: process.env.VAULT_ADDR, VAULT_TOKEN: process.env.VAULT_TOKEN };
  process.env.VAULT_ADDR = "http://vault.test:8200";
  process.env.VAULT_TOKEN = "placeholder-token-not-real";

  setKmsFetchForTests(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));

  await assert.rejects(
    () => vaultTransitSign({ keyName: "aegis-ci-mldsa87-v1", message: new TextEncoder().encode("x") }),
    (err) => {
      ok(err.code === "VAULT_BAD_RESPONSE", "T-KMS-14: VAULT_BAD_RESPONSE code");
      return true;
    }
  );
  passed++;
  console.log("PASS T-KMS-14: vault malformed response");

  resetKmsFetchForTests();
  restoreEnv(prev);
}

// T-KMS-15: Vault verify rejection
{
  const prev = {
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
    VAULT_TRANSIT_TOKEN: process.env.VAULT_TRANSIT_TOKEN,
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    KMS_OIDC_EXPECT_REPOSITORY: process.env.KMS_OIDC_EXPECT_REPOSITORY,
    KMS_OIDC_EXPECT_OWNER: process.env.KMS_OIDC_EXPECT_OWNER,
    KMS_OIDC_EXPECT_REF: process.env.KMS_OIDC_EXPECT_REF,
    KMS_OIDC_EXPECT_WORKFLOW: process.env.KMS_OIDC_EXPECT_WORKFLOW,
    KMS_OIDC_EXPECT_ENVIRONMENT: process.env.KMS_OIDC_EXPECT_ENVIRONMENT,
  };
  process.env.VAULT_ADDR = "http://vault.test:8200";
  process.env.KMS_BACKEND_MODE = "live";
  setupLiveOidcVaultEnv();

  setKmsFetchForTests(async (url) => {
    if (String(url).includes("/login")) {
      return new Response(
        JSON.stringify({ auth: { client_token: "mock-vault-token", lease_duration: 3600 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (String(url).includes("/transit/sign/")) {
      return new Response(JSON.stringify({ data: { signature: "vault:v1:bad", key_version: 1 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { valid: false } }), { status: 200 });
  });

  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = basePayload("verify-fail");
  const sig = await signPayload(signer, payload);
  const verified = await verifySignedPayload(signer, payload, sig);
  ok(!verified.ok, "T-KMS-15: vault verify failure returns ok=false");

  resetKmsFetchForTests();
  restoreEnv(prev);
}

// T-KMS-16: configuration validation helpers
{
  const mountBad = validateTransitMount("../bad");
  ok(!mountBad.ok, "T-KMS-16: invalid mount rejected");

  const keyBad = validateTransitKeyName("bad/key");
  ok(!keyBad.ok, "T-KMS-16: invalid transit key rejected");

  const prev = { VAULT_ADDR: process.env.VAULT_ADDR, VAULT_TOKEN: process.env.VAULT_TOKEN };
  delete process.env.VAULT_ADDR;
  delete process.env.VAULT_TOKEN;
  const vaultVal = validateVaultTransitEnv();
  ok(!vaultVal.ok && vaultVal.errors.includes("VAULT_ADDR missing"), "T-KMS-16: missing VAULT_ADDR");

  const cloudVal = validateCloudHsmEnv();
  ok(!cloudVal.ok, "T-KMS-16: missing CLOUD_HSM_PROVIDER");

  restoreEnv(prev);
}

// T-KMS-17: AWS configuration validation
{
  const prev = {
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
    AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID,
    AWS_REGION: process.env.AWS_REGION,
  };
  process.env.CLOUD_HSM_PROVIDER = "aws";
  delete process.env.AWS_KMS_KEY_ID;
  delete process.env.AWS_REGION;

  const val = validateCloudHsmEnv();
  ok(!val.ok && val.errors.some((e) => e.includes("AWS_KMS_KEY_ID")), "T-KMS-17: AWS key missing");
  ok(!val.ok && val.errors.some((e) => e.includes("AWS_REGION")), "T-KMS-17: AWS region missing");

  restoreEnv(prev);
}

// T-KMS-18: secret redaction in error messages
{
  const prev = { VAULT_TOKEN: process.env.VAULT_TOKEN };
  process.env.VAULT_TOKEN = "super-secret-placeholder-token-value";
  const redacted = redactKmsSecrets("failed with super-secret-placeholder-token-value");
  ok(!redacted.includes("super-secret-placeholder-token-value"), "T-KMS-18: token redacted from errors");
  ok(redacted.includes("[REDACTED_VAULT_TOKEN]"), "T-KMS-18: redaction marker present");
  restoreEnv(prev);
}

console.log(`\nKMS BACKEND HARDENING: ${passed} checks PASS`);
