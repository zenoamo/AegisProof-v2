// ============================================================================
// KMS signer tests (Phase 8.14 Task 2)
// Run: npm run test:kms-signer
// ============================================================================
import assert from "node:assert/strict";

const {
  createSigner,
  verifySignerConfiguration,
  signPayload,
  getPublicKeyMetadata,
  exportPrivateKeyMaterial,
  verifySignedPayload,
  clearMockHsmSlots,
  registerMockHsmTestKey,
  KmsSecurityError,
  SIGNER_ROLE_PROVENANCE,
  SIGNER_ROLE_OPERATOR_PQC,
  BACKEND_MOCK_HSM,
  BACKEND_VAULT_TRANSIT,
  BACKEND_CLOUD_HSM,
  PROVENANCE_DOMAIN,
} = await import("../../scripts/lib/kms-signer.mjs");

const { entrySignPayload, generateKeypair } = await import("../../scripts/lib/pqc-signature.mjs");
const { createDeploymentAuthPayload } = await import("../../scripts/lib/hybrid-auth-envelope.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

clearMockHsmSlots();

const { secretKey, publicKeyHex } = generateKeypair();
registerMockHsmTestKey("test-provenance-kms-01", { secretKey, publicKeyHex });

// T-KMS-01: valid signer configuration
{
  const cfg = {
    backend: BACKEND_MOCK_HSM,
    keyId: "test-provenance-kms-01",
    role: SIGNER_ROLE_PROVENANCE,
  };
  const v = verifySignerConfiguration(cfg);
  ok(v.ok, "T-KMS-01: verifySignerConfiguration valid");
  const signer = createSigner(cfg);
  ok(signer.keyId === "test-provenance-kms-01", "T-KMS-01: createSigner keyId");
  ok(signer.exportAllowed === false, "T-KMS-01: exportAllowed false");
  const meta = getPublicKeyMetadata(signer);
  ok(meta.publicKey === publicKeyHex, "T-KMS-01: getPublicKeyMetadata public key");
  ok(!meta.secretKey && !meta.privateKey, "T-KMS-01: no raw key in metadata");
}

// T-KMS-02: unknown keyId reject
{
  const v = verifySignerConfiguration({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "does-not-exist-in-registry",
    role: SIGNER_ROLE_PROVENANCE,
  });
  ok(!v.ok && v.errors.some((e) => e.includes("unknown keyId")), "T-KMS-02: unknown keyId reject");
  assert.throws(
    () =>
      createSigner({
        backend: BACKEND_VAULT_TRANSIT,
        keyId: "does-not-exist-in-registry",
        role: SIGNER_ROLE_PROVENANCE,
      }),
    KmsSecurityError,
    "T-KMS-02: createSigner throws for unknown keyId"
  );
  passed++;
  console.log("PASS T-KMS-02: createSigner throws for unknown keyId");
}

// T-KMS-03: algorithm mismatch reject
{
  const v = verifySignerConfiguration({
    backend: BACKEND_MOCK_HSM,
    keyId: "test-provenance-kms-01",
    role: SIGNER_ROLE_PROVENANCE,
    algorithm: "ML-DSA-44",
  });
  ok(!v.ok && v.errors.some((e) => e.includes("algorithm mismatch")), "T-KMS-03: algorithm mismatch reject");
}

// T-KMS-04: private key export attempt reject
{
  const signer = createSigner({
    backend: BACKEND_MOCK_HSM,
    keyId: "test-provenance-kms-01",
    role: SIGNER_ROLE_PROVENANCE,
  });
  assert.throws(() => exportPrivateKeyMaterial(signer), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-04: KmsSecurityError type");
    ok(err.code === "EXPORT_FORBIDDEN", "T-KMS-04: EXPORT_FORBIDDEN code");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-04: private key export attempt reject");
}

// T-KMS-05: signature verification success
{
  const signer = createSigner({
    backend: BACKEND_MOCK_HSM,
    keyId: "test-provenance-kms-01",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const entry = {
    artifact: "production.zkey",
    path: "crypto-artifacts/phase4/production.zkey",
    sha256: "ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571",
    size: 2881473,
    version: "v2",
    source: "crypto-artifacts",
  };
  const payload = entrySignPayload(entry);
  const sig = await signPayload(signer, payload);
  ok(typeof sig.signature === "string" && sig.signature.length > 0, "T-KMS-05: signPayload returns signature");
  ok(!sig.secretKey && !sig.privateKey, "T-KMS-05: signPayload no raw key material");
  const verified = await verifySignedPayload(signer, payload, sig);
  ok(verified.ok, "T-KMS-05: signature verification success");
}

// T-KMS-06: domain separation mismatch reject
{
  const signer = createSigner({
    backend: BACKEND_MOCK_HSM,
    keyId: "test-provenance-kms-01",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const badPayload = {
    domain: "WRONG_DOMAIN",
    artifact: "production.zkey",
    path: "x",
    sha256: "a".repeat(64),
    size: 1,
    version: "v2",
    source: "test",
  };
  await assert.rejects(() => signPayload(signer, badPayload), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-06: KmsSecurityError on bad domain");
    ok(err.code === "DOMAIN_MISMATCH", "T-KMS-06: DOMAIN_MISMATCH code");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-06: domain separation mismatch reject");
}

// Vault transit stub (no live connection)
{
  const v = verifySignerConfiguration({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  ok(v.ok, "vault-transit stub: valid config with registry key");
  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "test.wasm",
    path: "artifacts/test.wasm",
    sha256: "b".repeat(64),
    size: 100,
    version: "v2",
    source: "test",
  });
  const sig = await signPayload(signer, payload);
  ok(sig.stub === true, "vault-transit stub: stub signature flag");
  ok(sig.signature.startsWith("vault-stub-"), "vault-transit stub: signature format");
}

// Cloud HSM not configured — signing blocked
{
  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "test.r1cs",
    path: "artifacts/test.r1cs",
    sha256: "c".repeat(64),
    size: 50,
    version: "v2",
    source: "test",
  });
  await assert.rejects(() => signPayload(signer, payload), (err) => {
    ok(err instanceof KmsSecurityError, "cloud-hsm: NOT_CONFIGURED on sign");
    ok(err.code === "NOT_IMPLEMENTED", "cloud-hsm: NOT_IMPLEMENTED code");
    return true;
  });
  passed += 2;
  console.log("PASS cloud-hsm: signing not configured");
}

// T-KMS-07: Vault Transit live sign (mocked HTTP via OIDC)
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

  function makeJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.fakesignature`;
  }
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

  const { setKmsFetchForTests, resetKmsFetchForTests } = await import("../../scripts/lib/kms-backends/http-fetch.mjs");
  const { clearVaultAuthCacheForTests } = await import("../../scripts/lib/kms-backends/vault-auth.mjs");
  clearVaultAuthCacheForTests();
  setKmsFetchForTests(async (url) => {
    if (String(url).includes("/login")) {
      return new Response(
        JSON.stringify({ auth: { client_token: "mock-vault-token", lease_duration: 3600 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (String(url).includes("/transit/sign/")) {
      return new Response(JSON.stringify({ data: { signature: "vault:v1:mock-live-sig", key_version: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).includes("/transit/verify/")) {
      return new Response(JSON.stringify({ data: { valid: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });

  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "live.wasm",
    path: "artifacts/live.wasm",
    sha256: "d".repeat(64),
    size: 10,
    version: "v2",
    source: "test",
  });
  const sig = await signPayload(signer, payload);
  ok(sig.live === true, "T-KMS-07: vault live sign flag");
  ok(sig.signature === "vault:v1:mock-live-sig", "T-KMS-07: vault live signature");
  const verified = await verifySignedPayload(signer, payload, sig);
  ok(verified.ok, "T-KMS-07: vault live verify");

  resetKmsFetchForTests();
  clearVaultAuthCacheForTests();
  if (prev.VAULT_ADDR === undefined) delete process.env.VAULT_ADDR;
  else process.env.VAULT_ADDR = prev.VAULT_ADDR;
  if (prev.VAULT_TOKEN === undefined) delete process.env.VAULT_TOKEN;
  else process.env.VAULT_TOKEN = prev.VAULT_TOKEN;
  if (prev.VAULT_TRANSIT_TOKEN === undefined) delete process.env.VAULT_TRANSIT_TOKEN;
  else process.env.VAULT_TRANSIT_TOKEN = prev.VAULT_TRANSIT_TOKEN;
  if (prev.KMS_BACKEND_MODE === undefined) delete process.env.KMS_BACKEND_MODE;
  else process.env.KMS_BACKEND_MODE = prev.KMS_BACKEND_MODE;
  if (prev.VAULT_JWT_ROLE === undefined) delete process.env.VAULT_JWT_ROLE;
  else process.env.VAULT_JWT_ROLE = prev.VAULT_JWT_ROLE;
  if (prev.VAULT_OIDC_JWT === undefined) delete process.env.VAULT_OIDC_JWT;
  else process.env.VAULT_OIDC_JWT = prev.VAULT_OIDC_JWT;
  for (const k of [
    "KMS_OIDC_EXPECT_REPOSITORY",
    "KMS_OIDC_EXPECT_OWNER",
    "KMS_OIDC_EXPECT_REF",
    "KMS_OIDC_EXPECT_WORKFLOW",
    "KMS_OIDC_EXPECT_ENVIRONMENT",
  ]) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
}

// T-KMS-08: Cloud HSM HTTP gateway (mocked, explicit live mode)
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
    CLOUD_HSM_SIGN_URL: process.env.CLOUD_HSM_SIGN_URL,
    CLOUD_HSM_VERIFY_URL: process.env.CLOUD_HSM_VERIFY_URL,
    CLOUD_HSM_KEY_ID: process.env.CLOUD_HSM_KEY_ID,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.CLOUD_HSM_PROVIDER = "http";
  process.env.CLOUD_HSM_SIGN_URL = "http://hsm.test/sign";
  process.env.CLOUD_HSM_VERIFY_URL = "http://hsm.test/verify";
  process.env.CLOUD_HSM_KEY_ID = "aegis-ci-mldsa87-v1";

  const { setKmsFetchForTests, resetKmsFetchForTests } = await import("../../scripts/lib/kms-backends/http-fetch.mjs");
  setKmsFetchForTests(async (url) => {
    if (String(url).endsWith("/sign")) {
      return new Response(JSON.stringify({ signature: "ab".repeat(32) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).endsWith("/verify")) {
      return new Response(JSON.stringify({ valid: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });

  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "hsm.wasm",
    path: "artifacts/hsm.wasm",
    sha256: "e".repeat(64),
    size: 20,
    version: "v2",
    source: "test",
  });
  const sig = await signPayload(signer, payload);
  ok(sig.live === true, "T-KMS-08: cloud http sign live flag");
  ok(sig.signature === "ab".repeat(32), "T-KMS-08: cloud http signature");
  const verified = await verifySignedPayload(signer, payload, sig);
  ok(verified.ok, "T-KMS-08: cloud http verify");

  resetKmsFetchForTests();
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// T-KMS-09: Cloud HSM unsupported PQC on aws-kms without http gateway
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
    CLOUD_HSM_KEY_ID: process.env.CLOUD_HSM_KEY_ID,
    AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID,
    AWS_REGION: process.env.AWS_REGION,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.CLOUD_HSM_PROVIDER = "aws";
  process.env.AWS_KMS_KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000";
  process.env.AWS_REGION = "us-east-1";

  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "aws.wasm",
    path: "artifacts/aws.wasm",
    sha256: "f".repeat(64),
    size: 30,
    version: "v2",
    source: "test",
  });
  await assert.rejects(() => signPayload(signer, payload), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-09: aws-kms ML-DSA reject");
    ok(err.code === "UNSUPPORTED_ALGORITHM", "T-KMS-09: UNSUPPORTED_ALGORITHM code");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-09: aws-kms rejects ML-DSA provenance role");

  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// T-EXP-009A: stub mode + configured cloud HSM → hard reject
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
    CLOUD_HSM_SIGN_URL: process.env.CLOUD_HSM_SIGN_URL,
    CLOUD_HSM_KEY_ID: process.env.CLOUD_HSM_KEY_ID,
  };
  process.env.KMS_BACKEND_MODE = "stub";
  process.env.CLOUD_HSM_PROVIDER = "http";
  process.env.CLOUD_HSM_SIGN_URL = "http://hsm.test/sign";
  process.env.CLOUD_HSM_KEY_ID = "aegis-ci-mldsa87-v1";

  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "stub-block.wasm",
    path: "artifacts/stub-block.wasm",
    sha256: "1".repeat(64),
    size: 10,
    version: "v2",
    source: "test",
  });
  await assert.rejects(() => signPayload(signer, payload), (err) => {
    ok(err instanceof KmsSecurityError, "T-EXP-009A: KmsSecurityError on stub cloud-hsm");
    ok(err.code === "CLOUD_HSM_FORBIDDEN_IN_STUB_MODE", "T-EXP-009A: CLOUD_HSM_FORBIDDEN_IN_STUB_MODE");
    return true;
  });
  passed += 2;
  console.log("PASS T-EXP-009A: stub mode rejects configured cloud-hsm");

  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// T-EXP-009B: stub mode → cloud HSM HTTP fetch NOT called
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
    CLOUD_HSM_SIGN_URL: process.env.CLOUD_HSM_SIGN_URL,
    CLOUD_HSM_KEY_ID: process.env.CLOUD_HSM_KEY_ID,
  };
  process.env.KMS_BACKEND_MODE = "stub";
  process.env.CLOUD_HSM_PROVIDER = "http";
  process.env.CLOUD_HSM_SIGN_URL = "http://hsm.test/sign";
  process.env.CLOUD_HSM_KEY_ID = "aegis-ci-mldsa87-v1";

  const { setKmsFetchForTests, resetKmsFetchForTests } = await import("../../scripts/lib/kms-backends/http-fetch.mjs");
  let fetchCalled = false;
  setKmsFetchForTests(async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ signature: "00".repeat(32) }), { status: 200 });
  });

  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "stub-fetch.wasm",
    path: "artifacts/stub-fetch.wasm",
    sha256: "2".repeat(64),
    size: 10,
    version: "v2",
    source: "test",
  });

  await assert.rejects(() => signPayload(signer, payload), KmsSecurityError);
  ok(!fetchCalled, "T-EXP-009B: cloud HSM HTTP fetch not called in stub mode");

  resetKmsFetchForTests();
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// T-EXP-009C: explicit live mode preserves mocked cloud HSM signing
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    CLOUD_HSM_PROVIDER: process.env.CLOUD_HSM_PROVIDER,
    CLOUD_HSM_SIGN_URL: process.env.CLOUD_HSM_SIGN_URL,
    CLOUD_HSM_VERIFY_URL: process.env.CLOUD_HSM_VERIFY_URL,
    CLOUD_HSM_KEY_ID: process.env.CLOUD_HSM_KEY_ID,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.CLOUD_HSM_PROVIDER = "http";
  process.env.CLOUD_HSM_SIGN_URL = "http://hsm.test/sign";
  process.env.CLOUD_HSM_VERIFY_URL = "http://hsm.test/verify";
  process.env.CLOUD_HSM_KEY_ID = "aegis-ci-mldsa87-v1";

  const { setKmsFetchForTests, resetKmsFetchForTests } = await import("../../scripts/lib/kms-backends/http-fetch.mjs");
  let fetchCalled = false;
  setKmsFetchForTests(async (url) => {
    fetchCalled = true;
    if (String(url).endsWith("/sign")) {
      return new Response(JSON.stringify({ signature: "cd".repeat(32) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).endsWith("/verify")) {
      return new Response(JSON.stringify({ valid: true }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });

  const signer = createSigner({
    backend: BACKEND_CLOUD_HSM,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = entrySignPayload({
    artifact: "live-cloud.wasm",
    path: "artifacts/live-cloud.wasm",
    sha256: "3".repeat(64),
    size: 10,
    version: "v2",
    source: "test",
  });
  const sig = await signPayload(signer, payload);
  ok(fetchCalled, "T-EXP-009C: live mode calls cloud HSM HTTP fetch");
  ok(sig.live === true, "T-EXP-009C: live cloud-hsm signature flag");
  ok(sig.signature === "cd".repeat(32), "T-EXP-009C: live cloud-hsm signature returned");

  resetKmsFetchForTests();
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

clearMockHsmSlots();

console.log(`\nKMS SIGNER: ${passed} checks PASS`);
