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

function setFullOidcBindings() {
  process.env.KMS_OIDC_EXPECT_REPOSITORY = "zenoamo/AegisProof-v2";
  process.env.KMS_OIDC_EXPECT_OWNER = "zenoamo";
  process.env.KMS_OIDC_EXPECT_REF = "refs/tags/v*";
  process.env.KMS_OIDC_EXPECT_WORKFLOW = "Release";
  process.env.KMS_OIDC_EXPECT_ENVIRONMENT = "release-signing";
}

function clearOidcBindings() {
  delete process.env.KMS_OIDC_EXPECT_REPOSITORY;
  delete process.env.KMS_OIDC_EXPECT_OWNER;
  delete process.env.KMS_OIDC_EXPECT_REPOSITORY_OWNER;
  delete process.env.KMS_OIDC_EXPECT_REF;
  delete process.env.KMS_OIDC_EXPECT_WORKFLOW;
  delete process.env.KMS_OIDC_EXPECT_ENVIRONMENT;
  delete process.env.KMS_OIDC_EXPECT_SUBJECT;
  delete process.env.KMS_OIDC_EXPECT_SUB;
}

function setupLiveOidcEnv() {
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
  setFullOidcBindings();
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

// T-KMS-OIDC-10: signing failure → reject (live, vault bad response via OIDC)
{
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
  process.env.VAULT_ADDR = "https://vault.example.com";
  setupLiveOidcEnv();

  setKmsFetchForTests(async (url) => {
    if (String(url).includes("/login")) {
      return new Response(
        JSON.stringify({ auth: { client_token: "mock-vault-token", lease_duration: 3600 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
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
  clearOidcBindings();
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

// T-EXP-006A: live + all required bindings unset → reject
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "live";
  clearOidcBindings();
  const jwt = makeJwt({
    repository: "evil/evil-repo",
    repository_owner: "evil",
    ref: "refs/heads/main",
    workflow: "evil.yml",
    environment: "production",
  });
  try {
    assert.throws(
      () => validateOidcClaimBindings(decodeJwtPayload(jwt)),
      (err) => {
        ok(err instanceof VaultAuthError, "T-EXP-006A: VaultAuthError thrown");
        ok(err.code === "OIDC_BINDINGS_REQUIRED", "T-EXP-006A: OIDC_BINDINGS_REQUIRED");
        return true;
      }
    );
    passed += 2;
    console.log("PASS T-EXP-006A: live mode rejects missing bindings");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-006B: live + one required binding missing → reject
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "live";
  clearOidcBindings();
  process.env.KMS_OIDC_EXPECT_REPOSITORY = "zenoamo/AegisProof-v2";
  process.env.KMS_OIDC_EXPECT_OWNER = "zenoamo";
  process.env.KMS_OIDC_EXPECT_REF = "refs/tags/v*";
  process.env.KMS_OIDC_EXPECT_WORKFLOW = "Release";
  const jwt = makeJwt({ repository: "zenoamo/AegisProof-v2", ref: "refs/tags/v2.0.1" });
  try {
    assert.throws(
      () => validateOidcClaimBindings(decodeJwtPayload(jwt)),
      (err) => {
        ok(err.code === "OIDC_BINDINGS_REQUIRED", "T-EXP-006B: OIDC_BINDINGS_REQUIRED");
        ok(err.message.includes("environment"), "T-EXP-006B: missing environment reported");
        return true;
      }
    );
    passed += 2;
    console.log("PASS T-EXP-006B: live mode rejects partial bindings");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-006C: live + all required bindings + matching JWT → PASS
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "live";
  setFullOidcBindings();
  const jwt = makeJwt({
    repository: "zenoamo/AegisProof-v2",
    repository_owner: "zenoamo",
    ref: "refs/tags/v2.0.1",
    workflow: "Release",
    environment: "release-signing",
  });
  try {
    const result = validateOidcClaimBindings(decodeJwtPayload(jwt));
    ok(result.ok, "T-EXP-006C: valid live bindings accepted");
    console.log("PASS T-EXP-006C: live mode accepts matching claims");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-006D: live + mismatched repository → reject
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "live";
  setFullOidcBindings();
  const jwt = makeJwt({
    repository: "evil/evil-repo",
    repository_owner: "zenoamo",
    ref: "refs/tags/v2.0.1",
    workflow: "Release",
    environment: "release-signing",
  });
  try {
    assert.throws(
      () => validateOidcClaimBindings(decodeJwtPayload(jwt)),
      (err) => {
        ok(err.code === "OIDC_CLAIM_REJECTED", "T-EXP-006D: OIDC_CLAIM_REJECTED");
        return true;
      }
    );
    passed++;
    console.log("PASS T-EXP-006D: live mode rejects mismatched repository");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-006E: live + mismatched workflow/environment → reject
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "live";
  setFullOidcBindings();
  const jwtBadWorkflow = makeJwt({
    repository: "zenoamo/AegisProof-v2",
    repository_owner: "zenoamo",
    ref: "refs/tags/v2.0.1",
    workflow: "malicious.yml",
    environment: "release-signing",
  });
  const jwtBadEnv = makeJwt({
    repository: "zenoamo/AegisProof-v2",
    repository_owner: "zenoamo",
    ref: "refs/tags/v2.0.1",
    workflow: "Release",
    environment: "staging",
  });
  try {
    assert.throws(() => validateOidcClaimBindings(decodeJwtPayload(jwtBadWorkflow)), (err) => {
      ok(err.code === "OIDC_CLAIM_REJECTED", "T-EXP-006E: wrong workflow rejected");
      return true;
    });
    assert.throws(() => validateOidcClaimBindings(decodeJwtPayload(jwtBadEnv)), (err) => {
      ok(err.code === "OIDC_CLAIM_REJECTED", "T-EXP-006E: wrong environment rejected");
      return true;
    });
    passed += 2;
    console.log("PASS T-EXP-006E: live mode rejects mismatched workflow/environment");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-006F: stub mode + missing bindings → existing fail-open preserved
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE };
  process.env.KMS_BACKEND_MODE = "stub";
  clearOidcBindings();
  const jwt = makeJwt({
    repository: "evil/evil-repo",
    repository_owner: "evil",
    ref: "refs/heads/main",
    workflow: "evil.yml",
    environment: "production",
  });
  try {
    const result = validateOidcClaimBindings(decodeJwtPayload(jwt));
    ok(result.ok, "T-EXP-006F: stub mode preserves fail-open when bindings unset");
    console.log("PASS T-EXP-006F: stub mode behavior preserved");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-007A: live + VAULT_TOKEN → reject
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE, VAULT_TOKEN: process.env.VAULT_TOKEN, VAULT_ADDR: process.env.VAULT_ADDR };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_TOKEN = "fixture-not-a-real-token";
  try {
    await assert.rejects(() => resolveVaultAuthToken(), (err) => {
      ok(err instanceof VaultAuthError, "T-EXP-007A: VaultAuthError thrown");
      ok(err.code === "VAULT_STATIC_TOKEN_FORBIDDEN_IN_LIVE_MODE", "T-EXP-007A: forbidden code");
      return true;
    });
    passed += 2;
    console.log("PASS T-EXP-007A: live mode rejects VAULT_TOKEN");
  } finally {
    restoreEnv(prev);
  }
}

// T-EXP-007B: live + VAULT_TRANSIT_TOKEN → reject
{
  const prev = {
    KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
    VAULT_TOKEN: process.env.VAULT_TOKEN,
    VAULT_TRANSIT_TOKEN: process.env.VAULT_TRANSIT_TOKEN,
    VAULT_ADDR: process.env.VAULT_ADDR,
  };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.VAULT_ADDR = "https://vault.example.com";
  delete process.env.VAULT_TOKEN;
  process.env.VAULT_TRANSIT_TOKEN = "fixture-not-a-real-token";
  try {
    await assert.rejects(() => resolveVaultAuthToken(), (err) => {
      ok(err.code === "VAULT_STATIC_TOKEN_FORBIDDEN_IN_LIVE_MODE", "T-EXP-007B: forbidden code");
      return true;
    });
    passed++;
    console.log("PASS T-EXP-007B: live mode rejects VAULT_TRANSIT_TOKEN");
  } finally {
    restoreEnv(prev);
  }
}

// T-EXP-007C: live + no static token + valid OIDC bindings → OIDC path selected
{
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
  process.env.VAULT_ADDR = "https://vault.example.com";
  setupLiveOidcEnv();

  setKmsFetchForTests(async (url) => {
    if (String(url).includes("/login")) {
      return new Response(
        JSON.stringify({ auth: { client_token: "mock-oidc-vault-token", lease_duration: 3600 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("not found", { status: 404 });
  });

  try {
    const result = await resolveVaultAuthToken();
    ok(result.source === "oidc", "T-EXP-007C: OIDC path selected");
    ok(result.token === "mock-oidc-vault-token", "T-EXP-007C: mocked Vault token returned");
    console.log("PASS T-EXP-007C: live OIDC path preserved");
  } finally {
    restoreEnv(prev);
    clearOidcBindings();
  }
}

// T-EXP-007D: live + static token → reject before Vault login (no fetch)
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE, VAULT_TOKEN: process.env.VAULT_TOKEN, VAULT_ADDR: process.env.VAULT_ADDR };
  process.env.KMS_BACKEND_MODE = "live";
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_TOKEN = "fixture-not-a-real-token";

  let fetchCalled = false;
  setKmsFetchForTests(async () => {
    fetchCalled = true;
    return new Response("unexpected", { status: 500 });
  });

  try {
    await assert.rejects(() => resolveVaultAuthToken(), VaultAuthError);
    ok(!fetchCalled, "T-EXP-007D: no Vault fetch before static token rejection");
    console.log("PASS T-EXP-007D: reject before Vault login");
  } finally {
    resetKmsFetchForTests();
    restoreEnv(prev);
  }
}

// T-EXP-007E: stub mode + static token → existing behavior preserved
{
  const prev = { KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE, VAULT_TOKEN: process.env.VAULT_TOKEN, VAULT_ADDR: process.env.VAULT_ADDR };
  process.env.KMS_BACKEND_MODE = "stub";
  process.env.VAULT_ADDR = "https://vault.example.com";
  process.env.VAULT_TOKEN = "fixture-not-a-real-token";
  try {
    const result = await resolveVaultAuthToken();
    ok(result.source === "static", "T-EXP-007E: stub mode allows static token");
    console.log("PASS T-EXP-007E: stub mode behavior preserved");
  } finally {
    restoreEnv(prev);
  }
}

console.log(`\nKMS OIDC tests: ${passed} checks PASS`);
process.exit(0);
