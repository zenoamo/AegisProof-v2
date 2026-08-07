// ============================================================================
// Hybrid auth envelope tests (Phase 8.13 Task 6)
// Run: npm run test:hybrid-auth
// ============================================================================
import assert from "node:assert/strict";

const {
  AUTH_ENVELOPE_DOMAIN,
  CLASSICAL_ALGORITHM,
  PQC_ALGORITHM,
  createHybridAuthEnvelope,
  verifyHybridAuthEnvelope,
  createDeploymentAuthPayload,
  generateClassicalKeypair,
  generatePqcKeypair,
  buildAuthSignMessage,
  signClassical,
  verifyClassical,
} = await import("../scripts/lib/hybrid-auth-envelope.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const { privateKey: classicalSk, publicKey: classicalPk } = generateClassicalKeypair();
const { secretKey: pqcSk, publicKeyHex: pqcPkHex } = generatePqcKeypair();

const payload = createDeploymentAuthPayload("0xoperator", "deploy-verifier", { chainId: 1 });

// T-AUTH-01: valid classical only
const classicalOnly = createHybridAuthEnvelope(payload, { classicalPrivateKey: classicalSk });
ok(classicalOnly.classicalSignature?.algorithm === CLASSICAL_ALGORITHM, "T-AUTH-01 classical algorithm");
ok(!classicalOnly.pqcSignature?.signature, "T-AUTH-01 no PQC sig");
const v01 = verifyHybridAuthEnvelope(classicalOnly, {
  classicalPublicKey: classicalPk,
  requireClassical: true,
});
ok(v01.valid, "T-AUTH-01 valid classical only");

// T-AUTH-02: valid PQC only
const pqcOnly = createHybridAuthEnvelope(payload, {
  pqcPrivateKey: pqcSk,
  pqcPublicKeyHex: pqcPkHex,
});
ok(pqcOnly.pqcSignature?.algorithm === PQC_ALGORITHM, "T-AUTH-02 PQC algorithm");
ok(!pqcOnly.classicalSignature?.signature, "T-AUTH-02 no classical sig");
const v02 = verifyHybridAuthEnvelope(pqcOnly, { requirePqc: true });
ok(v02.valid, "T-AUTH-02 valid PQC only");

// T-AUTH-03: valid hybrid signature
const hybrid = createHybridAuthEnvelope(payload, {
  classicalPrivateKey: classicalSk,
  pqcPrivateKey: pqcSk,
  pqcPublicKeyHex: pqcPkHex,
});
const v03 = verifyHybridAuthEnvelope(hybrid, { classicalPublicKey: classicalPk });
ok(v03.valid, "T-AUTH-03 valid hybrid signature");

// T-AUTH-04: payload mutation reject
const mutated = JSON.parse(JSON.stringify(hybrid));
mutated.payload.operator = "0xattacker";
const v04 = verifyHybridAuthEnvelope(mutated, { classicalPublicKey: classicalPk });
ok(!v04.valid, "T-AUTH-04 payload mutation reject");

// T-AUTH-05: domain separation reject
const badDomain = { ...hybrid, domain: "WRONG_DOMAIN" };
const v05 = verifyHybridAuthEnvelope(badDomain, { classicalPublicKey: classicalPk });
ok(!v05.valid && v05.errors.some((e) => e.includes("domain mismatch")), "T-AUTH-05 domain separation reject");

// T-AUTH-06: wrong PQC key reject
const wrongPqc = generatePqcKeypair();
const wrongKeyEnv = JSON.parse(JSON.stringify(hybrid));
wrongKeyEnv.pqcSignature.publicKey = wrongPqc.publicKeyHex;
const v06 = verifyHybridAuthEnvelope(wrongKeyEnv, { classicalPublicKey: classicalPk });
ok(!v06.valid, "T-AUTH-06 wrong PQC key reject");

// T-AUTH-07: algorithm downgrade reject
const downgradeClassical = JSON.parse(JSON.stringify(hybrid));
downgradeClassical.classicalSignature.algorithm = "RSA";
const v07a = verifyHybridAuthEnvelope(downgradeClassical, { classicalPublicKey: classicalPk });
ok(!v07a.valid && v07a.errors.some((e) => e.includes("classical algorithm downgrade")), "T-AUTH-07 classical downgrade reject");

const downgradePqc = JSON.parse(JSON.stringify(hybrid));
downgradePqc.pqcSignature.algorithm = "ML-DSA-44";
const v07b = verifyHybridAuthEnvelope(downgradePqc, { classicalPublicKey: classicalPk });
ok(!v07b.valid && v07b.errors.some((e) => e.includes("PQC algorithm downgrade")), "T-AUTH-07 PQC downgrade reject");

// T-AUTH-08: signature replay reject
const otherPayload = createDeploymentAuthPayload("0xother", "upgrade-verifier", { chainId: 2 });
const replayed = createHybridAuthEnvelope(otherPayload, {
  classicalSignature: hybrid.classicalSignature.signature,
  pqcSignature: hybrid.pqcSignature.signature,
  pqcPublicKeyHex: pqcPkHex,
});
const v08 = verifyHybridAuthEnvelope(replayed, { classicalPublicKey: classicalPk });
ok(!v08.valid, "T-AUTH-08 signature replay reject");

// Invalid classical signature
const msg = buildAuthSignMessage(payload);
const badClassical = createHybridAuthEnvelope(payload, {
  classicalSignature: signClassical(msg, classicalSk).replace(/a/g, "b"),
  pqcPrivateKey: pqcSk,
  pqcPublicKeyHex: pqcPkHex,
});
const vClassicalBad = verifyHybridAuthEnvelope(badClassical, { classicalPublicKey: classicalPk });
ok(!vClassicalBad.valid, "invalid classical signature reject");

// Unknown publicKeyId
const unknownKey = JSON.parse(JSON.stringify(pqcOnly));
unknownKey.pqcSignature.publicKey = null;
unknownKey.pqcSignature.publicKeyId = "unknown-key-id";
const vUnknown = verifyHybridAuthEnvelope(unknownKey, { requirePqc: true });
ok(!vUnknown.valid && vUnknown.errors.some((e) => e.includes("unknown publicKeyId")), "unknown publicKeyId reject");

console.log(`\nHYBRID AUTH: ${passed} checks PASS`);
