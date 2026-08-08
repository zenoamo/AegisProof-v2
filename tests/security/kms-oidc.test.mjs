// ============================================================================
// KMS OIDC / Vault auth security tests (Phase 8.14 Task 4)
// Run: npm run test:kms-oidc
// ============================================================================
import assert from "node:assert/strict";

const {
  decodeJwtPayload,
  validateOidcClaimBindings,
  fetchGitHubOidcJwt,
  vaultJwtLogin,
  resolveVaultAuthToken,
  VaultAuthError,
  clearVaultAuthCacheForTests,
  readVaultOidcEnv,
  matchClaimPattern,
} = await import("../../scripts/lib/kms-backends/vault-auth.mjs");

const {
  createSigner,
  signPayload,
  KmsSecurityError,
  BACKEND_VAULT_TRANSIT,
  SIGNER_ROLE_PROVENANCE,
} = await import("../../scripts/lib/kms-signer.mjs");

const { entrySignPayload } = await import("../../scripts/lib/pqc-signature.mjs");
const { setKmsFetchForTests, resetKmsFetchForTests, redactKmsSecrets } = await import(
  "../../scripts/lib/kms-backends/http-fetch.mjs"
);

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
  clearVaultAuthCacheForTests();
  resetKmsFetchForTests();
}

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesignature`;
}

function basePayload(suffix) {
  return entrySignPayload({
    artifact: `oidc-${suffix}.wasm`,
    path: `artifacts/oidc-${suffix}.wasm`,
    sha256: "c".repeat(64),
    size: 1,
    version: "v2",
    source: "test",
  });
}

// T-KMS-OIDC-01: missing OIDC configuration → reject
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    ACTIONS_ID_TOKEN_REQUEST_URL: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.VAULT_ADDR = "https://vault.example.com";
  delete process.env.VAULT_TOKEN;
  delete process.env.VAULT_JWT_ROLE;
  delete process.env.VAULT_OIDC_JWT;
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  await assert.rejects(() => resolveVaultAuthToken(), (err) => {
    ok(err instanceof VaultAuthError, "T-KMS-OIDC-01: VaultAuthError thrown");
    ok(err.code === "OIDC_NOT_CONFIGURED", "T-KMS-OIDC-01: OIDC_NOT_CONFIGURED");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-OIDC-01: missing OIDC configuration rejected");

  restoreEnv(prev);
}

// T-KMS-OIDC-02: invalid JWT → reject
{
  assert.throws(
    () => decodeJwtPayload("not-a-jwt"),
    (err) => {
      ok(err instanceof VaultAuthError, "T-KMS-OIDC-02: invalid JWT throws");
      ok(err.code === "OIDC_INVALID_JWT", "T-KMS-OIDC-02: OIDC_INVALID_JWT");
      return true;
    }
  );
  passed += 2;
  console.log("PASS T-KMS-OIDC-02: invalid JWT rejected");
}

// T-KMS-OIDC-03: wrong repository → reject
{
  const jwt = makeJwt({ repository: "evil/other-repo", ref: "refs/heads/main" });
  process.env.KMS_OIDC_EXPECT_REPOSITORY = "zenoamo/AegisProof-v2";
  try {
    assert.throws(
      () => validateOidcClaimBindings(decodeJwtPayload(jwt)),
      (err) => {
        ok(err instanceof VaultAuthError, "T-KMS-OIDC-03: wrong repo throws");
        ok(err.code === "OIDC_CLAIM_REJECTED", "T-KMS-OIDC-03: OIDC_CLAIM_REJECTED");
        return true;
      }
    );
    passed += 2;
    console.log("PASS T-KMS-OIDC-03: wrong repository rejected");
  } finally {
    delete process.env.KMS_OIDC_EXPECT_REPOSITORY;
  }
}

// T-KMS-OIDC-04: wrong branch/ref → reject
{
  const jwt = makeJwt({ repository: "zenoamo/AegisProof-v2", ref: "refs/heads/feature/evil" });
  process.env.KMS_OIDC_EXPECT_REF = "refs/tags/v*";
  try {
    assert.throws(
      () => validateOidcClaimBindings(decodeJwtPayload(jwt)),
      (err) => {
        ok(err.code === "OIDC_CLAIM_REJECTED", "T-KMS-OIDC-04: wrong ref rejected");
        return true;
      }
    );
    passed++;
    ok(matchClaimPattern("refs/tags/v*", "refs/tags/v2.0.1"), "T-KMS-OIDC-04: glob match works");
    console.log("PASS T-KMS-OIDC-04: wrong branch/ref rejected");
  } finally {
    delete process.env.KMS_OIDC_EXPECT_REF;
  }
}

// T-KMS-OIDC-05: wrong workflow → reject
{
  const jwt = makeJwt({ workflow: "malicious.yml", repository: "zenoamo/AegisProof-v2" });
  process.env.KMS_OIDC_EXPECT_WORKFLOW = "Release";
  try {
    assert.throws(() => validateOidcClaimBindings(decodeJwtPayload(jwt)), VaultAuthError);
    passed++;
    console.log("PASS T-KMS-OIDC-05: wrong workflow rejected");
  } finally {
    delete process.env.KMS_OIDC_EXPECT_WORKFLOW;
  }
}

// T-KMS-OIDC-06: wrong environment → reject
{
  const jwt = makeJwt({ environment: "staging", repository: "zenoamo/AegisProof-v2" });
  process.env.KMS_OIDC_EXPECT_ENVIRONMENT = "release-signing";
  try {
    assert.throws(() => validateOidcClaimBindings(decodeJwtPayload(jwt)), VaultAuthError);
    passed++;
    console.log("PASS T-KMS-OIDC-06: wrong environment rejected");
  } finally {
    delete process.env.KMS_OIDC_EXPECT_ENVIRONMENT;
  }
}

// T-KMS-OIDC-07: Vault auth failure → reject
{
  const prev = {
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    KMS_OIDC_EXPECT_REPOSITORY: process.env.KMS_OIDC_EXPECT_REPOSITORY,
  };
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_JWT_ROLE = "ci-provenance-signer";
  process.env.VAULT_OIDC_JWT = makeJwt({ repository: "zenoamo/AegisProof-v2" });
  delete process.env.KMS_OIDC_EXPECT_REPOSITORY;

  setKmsFetchForTests(async () => new Response(JSON.stringify({ errors: ["permission denied"] }), { status: 403 }));

  await assert.rejects(() => vaultJwtLogin(process.env.VAULT_OIDC_JWT), (err) => {
    ok(err instanceof VaultAuthError, "T-KMS-OIDC-07: auth failure");
    ok(err.code === "VAULT_AUTH_FAILED", "T-KMS-OIDC-07: VAULT_AUTH_FAILED");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-OIDC-07: Vault auth failure rejected");

  restoreEnv(prev);
}

// T-KMS-OIDC-08: Vault unreachable → reject
{
  const prev = { VAULT_ADDR: process.env.VAULT_ADDR, VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE, VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT };
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_JWT_ROLE = "ci-provenance-signer";
  process.env.VAULT_OIDC_JWT = makeJwt({ repository: "zenoamo/AegisProof-v2" });

  setKmsFetchForTests(async () => {
    throw new Error("connection refused");
  });

  await assert.rejects(() => vaultJwtLogin(process.env.VAULT_OIDC_JWT), (err) => {
    ok(err instanceof VaultAuthError, "T-KMS-OIDC-08: unreachable");
    ok(err.code === "VAULT_UNAVAILABLE", "T-KMS-OIDC-08: VAULT_UNAVAILABLE");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-OIDC-08: Vault unreachable rejected");

  restoreEnv(prev);
}

// T-KMS-OIDC-09: unknown key → reject
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "stub";
  assert.throws(
    () =>
      createSigner({
        backend: BACKEND_VAULT_TRANSIT,
        keyId: "unknown-key-id-oidc-test",
        role: SIGNER_ROLE_PROVENANCE,
      }),
    (err) => {
      ok(err instanceof KmsSecurityError, "T-KMS-OIDC-09: unknown key");
      ok(err.code === "INVALID_CONFIG", "T-KMS-OIDC-09: INVALID_CONFIG");
      return true;
    }
  );
  passed += 2;
  console.log("PASS T-KMS-OIDC-09: unknown key rejected");
  restoreEnv(prev);
}

// T-KMS-OIDC-10: signing failure → reject (live, vault bad response)
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_TOKEN = "hvs.test-token-oidc-sign-fail";

  setKmsFetchForTests(async (url) => {
    if (String(url).includes("/transit/sign/")) {
      return new Response(JSON.stringify({ errors: ["unknown key"] }), { status: 404 });
    }
    return new Response(JSON.stringify({ data: { valid: true } }), { status: 200 });
  });

  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });

  await assert.rejects(() => signPayload(signer, basePayload("sign-fail")), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-OIDC-10: signing failure");
    ok(err.code === "VAULT_SIGN_FAILED", "T-KMS-OIDC-10: VAULT_SIGN_FAILED");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-OIDC-10: signing failure rejected");

  restoreEnv(prev);
}

// T-KMS-OIDC-11: verification failure path (stub mismatch)
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "stub";
  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });
  const payload = basePayload("verify-fail");
  const signed = await signPayload(signer, payload);
  const bad = { ...signed, signature: "vault-stub-deadbeefdeadbeefdeadbeefdeadbeef" };
  const { verifySignedPayload } = await import("../../scripts/lib/kms-signer.mjs");
  const result = await verifySignedPayload(signer, payload, bad);
  ok(!result.ok, "T-KMS-OIDC-11: verification failure detected");
  console.log("PASS T-KMS-OIDC-11: verification failure rejected");
  restoreEnv(prev);
}

// T-KMS-OIDC-12: live → stub fallback → reject
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
  };
  process.env.KMS_BACKEND_MODE = "live";
  delete process.env.VAULT_ADDR;
  delete process.env.VAULT_TOKEN;
  delete process.env.VAULT_JWT_ROLE;

  const signer = createSigner({
    backend: BACKEND_VAULT_TRANSIT,
    keyId: "aegis-ci-mldsa87-v1",
    role: SIGNER_ROLE_PROVENANCE,
  });

  await assert.rejects(() => signPayload(signer, basePayload("no-stub")), (err) => {
    ok(err instanceof KmsSecurityError, "T-KMS-OIDC-12: live no stub");
    ok(err.code === "VAULT_NOT_CONFIGURED", "T-KMS-OIDC-12: VAULT_NOT_CONFIGURED");
    return true;
  });
  passed += 2;
  console.log("PASS T-KMS-OIDC-12: live stub fallback forbidden");

  restoreEnv(prev);
}

// T-KMS-OIDC-13: secret redaction
{
  process.env.VAULT_TOKEN = "hvs.super-secret-token-value-12345";
  const msg = redactKmsSecrets(`Vault error with token hvs.super-secret-token-value-12345 leaked`);
  ok(!msg.includes("hvs.super-secret-token-value-12345"), "T-KMS-OIDC-13: token redacted");
  ok(msg.includes("[REDACTED_VAULT_TOKEN]"), "T-KMS-OIDC-13: redaction marker");
  delete process.env.VAULT_TOKEN;
  passed += 2;
  console.log("PASS T-KMS-OIDC-13: secret redaction");
}

// T-KMS-OIDC-14: OIDC fetch failure when request URL missing
{
  const prev = {
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    ACTIONS_ID_TOKEN_REQUEST_URL: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  };
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_JWT_ROLE = "ci-provenance-signer";
  delete process.env.VAULT_OIDC_JWT;
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  await assert.rejects(() => fetchGitHubOidcJwt(), (err) => {
    ok(
      err.code === "LOCAL_OIDC_CONTEXT" || err.code === "OIDC_NOT_CONFIGURED",
      "T-KMS-OIDC-14: OIDC fetch not configured"
    );
    return true;
  });
  passed++;
  console.log("PASS T-KMS-OIDC-14: OIDC fetch failure rejected");

  restoreEnv(prev);
}

// T-KMS-OIDC-15: successful claim binding acceptance
{
  const jwt = makeJwt({
    repository: "zenoamo/AegisProof-v2",
    repository_owner: "zenoamo",
    ref: "refs/tags/v2.0.1",
    workflow: "Release",
    environment: "release-signing",
    sub: "repo:zenoamo/AegisProof-v2:environment:release-signing",
  });
  process.env.KMS_OIDC_EXPECT_REPOSITORY = "zenoamo/AegisProof-v2";
  process.env.KMS_OIDC_EXPECT_OWNER = "zenoamo";
  process.env.KMS_OIDC_EXPECT_REF = "refs/tags/v*";
  process.env.KMS_OIDC_EXPECT_WORKFLOW = "Release";
  process.env.KMS_OIDC_EXPECT_ENVIRONMENT = "release-signing";
  try {
    const result = validateOidcClaimBindings(decodeJwtPayload(jwt));
    ok(result.ok, "T-KMS-OIDC-15: valid claims accepted");
    console.log("PASS T-KMS-OIDC-15: valid claim binding accepted");
  } finally {
    delete process.env.KMS_OIDC_EXPECT_REPOSITORY;
    delete process.env.KMS_OIDC_EXPECT_OWNER;
    delete process.env.KMS_OIDC_EXPECT_REF;
    delete process.env.KMS_OIDC_EXPECT_WORKFLOW;
    delete process.env.KMS_OIDC_EXPECT_ENVIRONMENT;
  }
}

// T-KMS-OIDC-16: readVaultOidcEnv configured with OIDC path
{
  const prev = {
    VAULT_ADDR: process.env.VAULT_ADDR,
    VAULT_JWT_ROLE: process.env.VAULT_JWT_ROLE,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
  };
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_JWT_ROLE = "ci-provenance-signer";
  process.env.VAULT_OIDC_JWT = makeJwt({});
  const env = readVaultOidcEnv();
  ok(env.configured && env.oidcCapable, "T-KMS-OIDC-16: OIDC env configured");
  restoreEnv(prev);
  console.log("PASS T-KMS-OIDC-16: OIDC environment detection");
}

// T-KMS-OIDC-17: local runner without OIDC → LOCAL_OIDC_CONTEXT
{
  const prev = {
    GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
    VAULT_OIDC_JWT: process.env.VAULT_OIDC_JWT,
    ACTIONS_ID_TOKEN_REQUEST_URL: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  };
  delete process.env.GITHUB_ACTIONS;
  delete process.env.VAULT_OIDC_JWT;
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  const { diagnoseOidcContext } = await import("../../scripts/lib/kms-backends/vault-auth.mjs");
  const d = diagnoseOidcContext();
  ok(!d.ok, "T-KMS-OIDC-17: local context not ok");
  ok(d.code === "LOCAL_OIDC_CONTEXT", "T-KMS-OIDC-17: LOCAL_OIDC_CONTEXT code");

  await assert.rejects(() => fetchGitHubOidcJwt(), (err) => {
    ok(err.code === "LOCAL_OIDC_CONTEXT", "T-KMS-OIDC-17: fetch rejects locally");
    return true;
  });
  passed += 3;
  console.log("PASS T-KMS-OIDC-17: local OIDC context rejected cleanly");

  restoreEnv(prev);
}

console.log(`\nKMS OIDC tests: ${passed} checks PASS`);
process.exit(0);
