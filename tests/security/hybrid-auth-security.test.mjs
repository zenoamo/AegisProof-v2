// ============================================================================
// Penetration Test — Hybrid auth envelope security (PT-06)
// Run: npm run test:penetration
// ============================================================================
import assert from "node:assert/strict";

const {
  AUTH_ENVELOPE_DOMAIN,
  createHybridAuthEnvelope,
  verifyHybridAuthEnvelope,
  createDeploymentAuthPayload,
  generateClassicalKeypair,
  generatePqcKeypair,
  buildAuthSignMessage,
  signClassical,
  signPqcAuth,
} = await import("../../scripts/lib/hybrid-auth-envelope.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const { privateKey: classicalSk, publicKey: classicalPk } = generateClassicalKeypair();
const { secretKey: pqcSk, publicKeyHex: pqcPkHex } = generatePqcKeypair();
const payload = createDeploymentAuthPayload("0xoperator", "deploy-verifier", { chainId: 1 });

const hybrid = createHybridAuthEnvelope(payload, {
  classicalPrivateKey: classicalSk,
  pqcPrivateKey: pqcSk,
  pqcPublicKeyHex: pqcPkHex,
});

const valid = verifyHybridAuthEnvelope(hybrid, { classicalPublicKey: classicalPk });
ok(valid.valid, "PT-06: valid hybrid envelope baseline PASS");

// Payload tampering
const tampered = JSON.parse(JSON.stringify(hybrid));
tampered.payload.operator = "0xattacker";
const p06a = verifyHybridAuthEnvelope(tampered, { classicalPublicKey: classicalPk });
ok(!p06a.valid, "PT-06: payload tampering returns failure");

// Signature mismatch (classical)
const sigMismatch = JSON.parse(JSON.stringify(hybrid));
sigMismatch.classicalSignature.signature = "00".repeat(64);
const p06b = verifyHybridAuthEnvelope(sigMismatch, { classicalPublicKey: classicalPk });
ok(!p06b.valid && p06b.errors.some((e) => e.includes("classical")), "PT-06: classical signature mismatch failure");

// Invalid ECDSA (wrong key)
const wrongClassical = generateClassicalKeypair();
const p06c = verifyHybridAuthEnvelope(hybrid, { classicalPublicKey: wrongClassical.publicKey });
ok(!p06c.valid, "PT-06: invalid ECDSA (wrong key) failure");

// Invalid ML-DSA
const wrongPqc = JSON.parse(JSON.stringify(hybrid));
wrongPqc.pqcSignature.publicKey = generatePqcKeypair().publicKeyHex;
const p06d = verifyHybridAuthEnvelope(wrongPqc, { classicalPublicKey: classicalPk });
ok(!p06d.valid && p06d.errors.some((e) => e.includes("PQC")), "PT-06: invalid ML-DSA failure");

// Domain separation mismatch
const badDomain = { ...hybrid, domain: "EVIL_DOMAIN" };
const p06e = verifyHybridAuthEnvelope(badDomain, { classicalPublicKey: classicalPk });
ok(!p06e.valid && p06e.errors.some((e) => e.includes("domain mismatch")), "PT-06: domain separation mismatch failure");

const badPayloadDomain = JSON.parse(JSON.stringify(hybrid));
badPayloadDomain.payload.domain = "NOT_DEPLOYMENT_AUTH";
const p06f = verifyHybridAuthEnvelope(badPayloadDomain, { classicalPublicKey: classicalPk });
ok(!p06f.valid, "PT-06: payload domain mismatch failure");

// Partial signature tamper (PQC only)
const pqcTamper = JSON.parse(JSON.stringify(hybrid));
pqcTamper.pqcSignature.signature = "ff".repeat(100);
const p06g = verifyHybridAuthEnvelope(pqcTamper, { classicalPublicKey: classicalPk });
ok(!p06g.valid, "PT-06: PQC signature tamper failure");

// Message rebinding (sign different payload, attach to envelope)
const otherPayload = createDeploymentAuthPayload("0xother", "malicious-action", { chainId: 99 });
const rebinding = createHybridAuthEnvelope(otherPayload, { classicalPrivateKey: classicalSk });
const stolen = JSON.parse(JSON.stringify(hybrid));
stolen.classicalSignature = rebinding.classicalSignature;
const p06h = verifyHybridAuthEnvelope(stolen, { classicalPublicKey: classicalPk });
ok(!p06h.valid, "PT-06: cross-payload signature rebinding failure");

// Algorithm downgrade
const downgrade = JSON.parse(JSON.stringify(hybrid));
downgrade.pqcSignature.algorithm = "ML-DSA-44";
const p06i = verifyHybridAuthEnvelope(downgrade, { classicalPublicKey: classicalPk });
ok(!p06i.valid && p06i.errors.some((e) => e.includes("downgrade") || e.includes("algorithm")), "PT-06: PQC algorithm downgrade failure");

// verifyHybridAuthEnvelope export alias
ok(typeof verifyHybridAuthEnvelope === "function", "PT-06: verifyHybridAuthEnvelope exported");

const msg = buildAuthSignMessage(payload);
ok(new TextDecoder().decode(msg).startsWith(AUTH_ENVELOPE_DOMAIN), "PT-06: auth domain separator present");

const classicalOnly = createHybridAuthEnvelope(payload, { classicalPrivateKey: classicalSk });
const p06j = verifyHybridAuthEnvelope(classicalOnly, { classicalPublicKey: classicalPk, requireClassical: true });
ok(p06j.valid, "PT-06: classical-only valid path");

const emptySig = createHybridAuthEnvelope(payload, {});
const p06k = verifyHybridAuthEnvelope(emptySig, { requireClassical: true, requirePqc: true });
ok(!p06k.valid, "PT-06: empty signatures with strict requirements failure");

console.log(`\nHYBRID AUTH SECURITY: ${passed} checks PASS`);
