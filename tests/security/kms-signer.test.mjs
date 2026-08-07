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
  const verified = verifySignedPayload(signer, payload, sig);
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

// Cloud HSM interface — not implemented (signing blocked)
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
    ok(err instanceof KmsSecurityError, "cloud-hsm: NOT_IMPLEMENTED on sign");
    ok(err.code === "NOT_IMPLEMENTED", "cloud-hsm: NOT_IMPLEMENTED code");
    return true;
  });
  passed += 2;
  console.log("PASS cloud-hsm: signing not implemented");
}

clearMockHsmSlots();

console.log(`\nKMS SIGNER: ${passed} checks PASS`);
