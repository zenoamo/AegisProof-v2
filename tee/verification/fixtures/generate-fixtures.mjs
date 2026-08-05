/**
 * One-time research fixture generator for Phase 8.9B offline verification PoC.
 * Run: node tee/verification/fixtures/generate-fixtures.mjs
 * Output: tdx/ and sev/ JSON fixtures (RESEARCH_FIXTURE_ONLY)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createCert(subject, issuerKey, issuerCert, days = 365) {
  // Minimal self-signed or CA-signed cert using Node 18+ undocumented helpers
  // Fallback: generate SPKI-only collateral without full X509 chain for PoC
  throw new Error('use generateWithOpenSSL');
}

function generateKeyPair(curve) {
  return crypto.generateKeyPairSync('ec', { namedCurve: curve });
}

function signPayload(privateKey, payload, curve) {
  const hash = curve === 'P-384' ? 'SHA384' : 'SHA256';
  const sign = crypto.createSign(hash);
  sign.update(payload);
  return sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
}

function verifyPayload(publicKey, payload, signature, curve) {
  const hash = curve === 'P-384' ? 'SHA384' : 'SHA256';
  const verify = crypto.createVerify(hash);
  verify.update(payload);
  return verify.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
}

function exportPublicKeyPem(publicKey) {
  return publicKey.export({ type: 'spki', format: 'pem' });
}

function writeJson(relPath, data) {
  const full = path.join(__dirname, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n');
}

// --- TDX (P-256) ---
const tdxKeys = generateKeyPair('P-256');
const tdxBody = Buffer.alloc(48);
tdxBody.writeUInt16LE(4, 0);
for (let i = 2; i < 48; i++) tdxBody[i] = (i * 7) % 256;

const tdxSig = signPayload(tdxKeys.privateKey, tdxBody, 'P-256');
const tdxQuote = Buffer.concat([tdxBody, tdxSig]);

writeJson('tdx/quote.json', {
  RESEARCH_FIXTURE_ONLY: true,
  description: 'Synthetic TDX quote for offline DCAP PoC — not production attestation',
  quoteHex: tdxQuote.toString('hex'),
  signedPayloadOffset: 0,
  signedPayloadLength: 48,
  signatureOffset: 48,
  signatureLength: 64,
  hashAlgorithm: 'SHA256',
  curve: 'P-256',
});

writeJson('tdx/collateral.json', {
  RESEARCH_FIXTURE_ONLY: true,
  description: 'Synthetic research public key — not Intel DCAP production collateral',
  leafPublicKeyPem: exportPublicKeyPem(tdxKeys.publicKey),
  certificateChainPem: [],
  note: 'Empty chain; PoC verifies signature against leaf public key only',
});

// Tampered TDX for negative test
const tdxBadBody = Buffer.from(tdxBody);
tdxBadBody[10] ^= 0xff;
const tdxBadQuote = Buffer.concat([tdxBadBody, tdxSig]);
writeJson('tdx/quote-invalid.json', {
  RESEARCH_FIXTURE_ONLY: true,
  description: 'Tampered TDX quote — signature must fail verification',
  quoteHex: tdxBadQuote.toString('hex'),
  signedPayloadOffset: 0,
  signedPayloadLength: 48,
  signatureOffset: 48,
  signatureLength: 64,
  hashAlgorithm: 'SHA256',
  curve: 'P-256',
});

// --- SEV (P-384) ---
const sevKeys = generateKeyPair('P-384');
const sevReport = Buffer.alloc(1184);
sevReport.writeUInt32LE(2, 0);
for (let i = 4; i < 672; i++) sevReport[i] = (i * 3) % 256;

const sevPayload = sevReport.subarray(0, 672);
const sevSig = signPayload(sevKeys.privateKey, sevPayload, 'P-384');
sevSig.copy(sevReport, 672);

writeJson('sev/report.json', {
  RESEARCH_FIXTURE_ONLY: true,
  description: 'Synthetic SEV-SNP report for offline VCEK PoC — not production attestation',
  reportHex: sevReport.toString('hex'),
  signedPayloadOffset: 0,
  signedPayloadLength: 672,
  signatureOffset: 672,
  signatureLength: 96,
  hashAlgorithm: 'SHA384',
  curve: 'P-384',
});

writeJson('sev/collateral.json', {
  RESEARCH_FIXTURE_ONLY: true,
  description: 'Synthetic research public key — not AMD KDS production VCEK',
  leafPublicKeyPem: exportPublicKeyPem(sevKeys.publicKey),
  certificateChainPem: [],
  note: 'Empty chain; PoC verifies signature against leaf public key only',
});

const sevBadReport = Buffer.from(sevReport);
sevBadReport[100] ^= 0xff;
writeJson('sev/report-invalid.json', {
  RESEARCH_FIXTURE_ONLY: true,
  description: 'Tampered SEV report — signature must fail verification',
  reportHex: sevBadReport.toString('hex'),
  signedPayloadOffset: 0,
  signedPayloadLength: 672,
  signatureOffset: 672,
  signatureLength: 96,
  hashAlgorithm: 'SHA384',
  curve: 'P-384',
});

// Sanity check
assert(verifyPayload(tdxKeys.publicKey, tdxBody, tdxSig, 'P-256'));
assert(verifyPayload(sevKeys.publicKey, sevPayload, sevSig, 'P-384'));

function assert(cond) {
  if (!cond) throw new Error('fixture generation sanity check failed');
}

console.log('✅ Research fixtures generated under tee/verification/fixtures/');
