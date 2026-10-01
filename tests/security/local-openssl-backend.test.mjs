// Local OpenSSL KMS backend regression tests (PR #29).
import assert from "node:assert/strict";

const { localOpenSslSign, localOpenSslVerify, LocalOpenSslError } =
  await import("../../scripts/lib/kms-backends/local-openssl.mjs");
const {
  setKmsFetchForTests,
  resetKmsFetchForTests,
} = await import("../../scripts/lib/kms-backends/http-fetch.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const previous = {
  LOCAL_OPENSSL_SIGNER_URL: process.env.LOCAL_OPENSSL_SIGNER_URL,
  LOCAL_OPENSSL_KEY_ID: process.env.LOCAL_OPENSSL_KEY_ID,
  VAULT_TOKEN: process.env.VAULT_TOKEN,
  VAULT_TRANSIT_TOKEN: process.env.VAULT_TRANSIT_TOKEN,
  KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE,
};

try {
  process.env.LOCAL_OPENSSL_SIGNER_URL = "https://signer.test/";
  process.env.LOCAL_OPENSSL_KEY_ID = "aegis-ci-mldsa87-v1";
  process.env.VAULT_TOKEN = "test-vault-token";
  delete process.env.VAULT_TRANSIT_TOKEN;
  process.env.KMS_BACKEND_MODE = "live";

  let signCalls = 0;
  let verifyCalls = 0;
  let lastAuth = "";

  setKmsFetchForTests(async (url, options = {}) => {
    const u = String(url);
    lastAuth = String(options.headers?.Authorization ?? "");

    if (u.endsWith("/sign")) {
      signCalls++;
      return new Response(
        JSON.stringify({
          signature: "dGVzdC1zaWduYXR1cmU=",
          encoding: "base64",
          algorithm: "ML-DSA-87",
          keyId: "aegis-ci-mldsa87-v1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (u.endsWith("/verify")) {
      verifyCalls++;
      return new Response(
        JSON.stringify({
          valid: true,
          algorithm: "ML-DSA-87",
          keyId: "aegis-ci-mldsa87-v1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("not found", { status: 404 });
  });

  // T-LOCAL-01: live sign reaches the configured signer.
  const signed = await localOpenSslSign({
    message: new TextEncoder().encode("aegis-local-openssl-test"),
    keyId: "aegis-ci-mldsa87-v1",
  });
  ok(signCalls === 1, "T-LOCAL-01: sign endpoint called once");
  ok(signed.live === true, "T-LOCAL-01: live flag set");
  ok(signed.backend === "local-openssl", "T-LOCAL-01: backend metadata");
  ok(signed.encoding === "base64", "T-LOCAL-01: signature encoding");
  ok(lastAuth === "Bearer test-vault-token", "T-LOCAL-01: Vault token forwarded as bearer auth");
  ok(!JSON.stringify(signed).includes("test-vault-token"), "T-LOCAL-01: Vault token not returned");

  // T-LOCAL-02: verify success.
  const verified = await localOpenSslVerify({
    message: new TextEncoder().encode("aegis-local-openssl-test"),
    signature: signed.signature,
    keyId: "aegis-ci-mldsa87-v1",
  });
  ok(verifyCalls === 1, "T-LOCAL-02: verify endpoint called once");
  ok(verified.ok === true, "T-LOCAL-02: valid signature accepted");

  // T-LOCAL-03: wrong keyId is rejected before network access.
  await assert.rejects(
    () =>
      localOpenSslSign({
        message: new TextEncoder().encode("x"),
        keyId: "wrong-key",
      }),
    (err) => {
      ok(err instanceof LocalOpenSslError, "T-LOCAL-03: key mismatch error type");
      ok(err.code === "KEY_ID_MISMATCH", "T-LOCAL-03: key mismatch code");
      return true;
    }
  );
  ok(signCalls === 1, "T-LOCAL-03: key mismatch does not call signer");

  // T-LOCAL-04: malformed signer response is rejected.
  setKmsFetchForTests(async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  await assert.rejects(
    () =>
      localOpenSslSign({
        message: new TextEncoder().encode("x"),
        keyId: "aegis-ci-mldsa87-v1",
      }),
    (err) => {
      ok(err instanceof LocalOpenSslError, "T-LOCAL-04: malformed response error type");
      ok(err.code === "BAD_RESPONSE", "T-LOCAL-04: malformed response code");
      return true;
    }
  );

  // T-LOCAL-05: signer HTTP errors are surfaced without exposing the token.
  setKmsFetchForTests(async () =>
    new Response(JSON.stringify({ error: "permission denied" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  );
  await assert.rejects(
    () =>
      localOpenSslSign({
        message: new TextEncoder().encode("x"),
        keyId: "aegis-ci-mldsa87-v1",
      }),
    (err) => {
      ok(err instanceof LocalOpenSslError, "T-LOCAL-05: HTTP error type");
      ok(err.code === "LOCAL_OPENSSL_ERROR", "T-LOCAL-05: HTTP error code");
      ok(!err.message.includes("test-vault-token"), "T-LOCAL-05: token absent from error");
      return true;
    }
  );

  console.log(`\\nLOCAL OPENSSL KMS BACKEND: ${passed} checks PASS`);
} finally {
  resetKmsFetchForTests();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
