// ============================================================================
// Canonical v2 proving-path guard.
// Rejects a 29-public-signal legacy circuit before proof generation.
// Does not modify, pad, or reconstruct circuit artifacts.
// ============================================================================
import fs from "fs";

export const CANONICAL_V2_PUBLIC_SIGNALS = 30;
export const CANONICAL_V2_IC_LENGTH = 31;

export class CanonicalV2ArtifactError extends Error {
  constructor(message) {
    super(message);
    this.name = "CanonicalV2ArtifactError";
  }
}

const UNCONFIRMED =
  "artifact mismatch: cannot confirm public signal count; canonical v2 requires 30 public signals";

function failUnconfirmed() {
  throw new CanonicalV2ArtifactError(UNCONFIRMED);
}

/**
 * Read nPublic = nPubOut + nPubIn from an R1CS header.
 * Does not load constraints. A 29-count is returned, not rejected.
 * @param {string} file
 */
export function readR1csPublicSignalCount(file) {
  if (!file || !fs.existsSync(file)) failUnconfirmed();
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const preamble = Buffer.alloc(12);
    if (fs.readSync(fd, preamble, 0, 12, 0) !== 12) failUnconfirmed();
    if (preamble.toString("ascii", 0, 4) !== "r1cs") failUnconfirmed();
    const nSections = preamble.readUInt32LE(8);
    if (!Number.isInteger(nSections) || nSections < 1 || nSections > 64) failUnconfirmed();

    let offset = 12;
    for (let i = 0; i < nSections; i++) {
      const sectionHead = Buffer.alloc(12);
      if (fs.readSync(fd, sectionHead, 0, 12, offset) !== 12) failUnconfirmed();
      const type = sectionHead.readUInt32LE(0);
      const size = Number(sectionHead.readBigUInt64LE(4));
      if (!Number.isSafeInteger(size) || size < 0) failUnconfirmed();
      offset += 12;
      if (type === 1) {
        if (size < 16) failUnconfirmed();
        const data = Buffer.alloc(size);
        if (fs.readSync(fd, data, 0, size, offset) !== size) failUnconfirmed();
        const n8 = data.readUInt32LE(0);
        if (n8 < 1 || 4 + n8 + 16 > size) failUnconfirmed();
        let cursor = 4 + n8;
        cursor += 4;
        const nPubOut = data.readUInt32LE(cursor);
        cursor += 4;
        const nPubIn = data.readUInt32LE(cursor);
        cursor += 4;
        const nPrvIn = data.readUInt32LE(cursor);
        const nPublic = nPubOut + nPubIn;
        if (!Number.isInteger(nPublic) || nPublic < 0) failUnconfirmed();
        return { nPubOut, nPubIn, nPrvIn, nPublic };
      }
      offset += size;
    }
  } catch (error) {
    if (error instanceof CanonicalV2ArtifactError) throw error;
    failUnconfirmed();
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  failUnconfirmed();
}

/**
 * @param {string} file
 */
export function readVkeyPublicSignalCount(file) {
  if (!file || !fs.existsSync(file)) failUnconfirmed();
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    failUnconfirmed();
  }
  if (typeof json?.nPublic !== "number" || !Array.isArray(json.IC)) {
    throw new CanonicalV2ArtifactError(
      "artifact mismatch: cannot confirm verification key public signal count; canonical v2 requires 30 public signals"
    );
  }
  return { nPublic: json.nPublic, icLength: json.IC.length };
}

/**
 * Fail closed before canonical proof generation.
 * R1CS nPublic, verification-key nPublic, and IC length must all describe 30 signals.
 * A 30-element publicSignals array does not upgrade a 29-signal R1CS.
 * @param {{ r1cs?: string, vkey?: string, publicSignals?: unknown }} paths
 */
export function assertCanonicalV2ProvingArtifacts(paths = {}) {
  const r1cs = readR1csPublicSignalCount(paths.r1cs);
  const vkey = readVkeyPublicSignalCount(paths.vkey);
  const signals = paths.publicSignals;
  const padded =
    Array.isArray(signals) &&
    signals.length === CANONICAL_V2_PUBLIC_SIGNALS &&
    r1cs.nPublic !== CANONICAL_V2_PUBLIC_SIGNALS;

  if (padded) {
    throw new CanonicalV2ArtifactError(
      `artifact mismatch: padded publicSignals[${signals.length}] cannot make an R1CS with nPublic=${r1cs.nPublic} into the canonical v2 circuit; canonical v2 requires 30 public signals`
    );
  }

  if (r1cs.nPublic !== CANONICAL_V2_PUBLIC_SIGNALS) {
    throw new CanonicalV2ArtifactError(
      `artifact mismatch: canonical v2 requires 30 public signals (R1CS nPublic=${r1cs.nPublic}, nPubOut=${r1cs.nPubOut}, nPubIn=${r1cs.nPubIn})`
    );
  }

  if (vkey.nPublic !== CANONICAL_V2_PUBLIC_SIGNALS || vkey.icLength !== CANONICAL_V2_IC_LENGTH) {
    throw new CanonicalV2ArtifactError(
      `artifact mismatch: canonical v2 requires 30 public signals (verification key nPublic=${vkey.nPublic}, IC.length=${vkey.icLength})`
    );
  }

  if (r1cs.nPublic !== vkey.nPublic) {
    throw new CanonicalV2ArtifactError(
      `artifact mismatch: R1CS nPublic=${r1cs.nPublic} does not match verification key nPublic=${vkey.nPublic}; canonical v2 requires 30 public signals`
    );
  }

  if (signals !== undefined) {
    if (!Array.isArray(signals) || signals.length !== CANONICAL_V2_PUBLIC_SIGNALS) {
      const length = Array.isArray(signals) ? signals.length : "unreadable";
      throw new CanonicalV2ArtifactError(
        `artifact mismatch: canonical v2 requires 30 public signals (publicSignals length=${length})`
      );
    }
  }

  return {
    nPublic: CANONICAL_V2_PUBLIC_SIGNALS,
    r1csNPublic: r1cs.nPublic,
    vkeyNPublic: vkey.nPublic,
    icLength: vkey.icLength,
  };
}
