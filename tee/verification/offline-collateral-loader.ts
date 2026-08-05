import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  OfflineCollateralFixture,
  OfflineQuoteFixture,
  OfflineReportFixture,
  OfflineSevFixtureBundle,
  OfflineTdxFixtureBundle,
} from './offline-collateral-interface.js';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function readJson<T>(relPath: string): T {
  const full = path.join(FIXTURES_DIR, relPath);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw) as T;
}

function assertResearchFixture(meta: { RESEARCH_FIXTURE_ONLY?: boolean }, label: string): void {
  if (!meta.RESEARCH_FIXTURE_ONLY) {
    throw new Error(`${label} missing RESEARCH_FIXTURE_ONLY marker`);
  }
}

/**
 * Phase 8.9B offline collateral loader.
 * Filesystem only — no network, no PCCS/KDS.
 */
export class OfflineCollateralLoader {
  static loadTdxBundle(quoteFile = 'tdx/quote.json', collateralFile = 'tdx/collateral.json'): OfflineTdxFixtureBundle {
    const quote = readJson<OfflineQuoteFixture>(quoteFile);
    const collateral = readJson<OfflineCollateralFixture>(collateralFile);
    assertResearchFixture(quote, quoteFile);
    assertResearchFixture(collateral, collateralFile);
    return { quote, collateral };
  }

  static loadSevBundle(reportFile = 'sev/report.json', collateralFile = 'sev/collateral.json'): OfflineSevFixtureBundle {
    const report = readJson<OfflineReportFixture>(reportFile);
    const collateral = readJson<OfflineCollateralFixture>(collateralFile);
    assertResearchFixture(report, reportFile);
    assertResearchFixture(collateral, collateralFile);
    return { report, collateral };
  }

  static loadTdxQuote(relPath: string): OfflineQuoteFixture {
    const quote = readJson<OfflineQuoteFixture>(relPath);
    assertResearchFixture(quote, relPath);
    return quote;
  }

  static loadSevReport(relPath: string): OfflineReportFixture {
    const report = readJson<OfflineReportFixture>(relPath);
    assertResearchFixture(report, relPath);
    return report;
  }

  static loadCollateral(relPath: string): OfflineCollateralFixture {
    const collateral = readJson<OfflineCollateralFixture>(relPath);
    assertResearchFixture(collateral, relPath);
    return collateral;
  }
}

/**
 * Verify optional research certificate chain (leaf → root order).
 * Empty chain returns true (SPKI-only PoC mode).
 */
export function verifyResearchCertChain(certificateChainPem: string[]): boolean {
  if (certificateChainPem.length === 0) {
    return true;
  }
  for (let i = 0; i < certificateChainPem.length - 1; i++) {
    const child = new crypto.X509Certificate(certificateChainPem[i]);
    const parent = new crypto.X509Certificate(certificateChainPem[i + 1]);
    if (!child.verify(parent.publicKey)) {
      return false;
    }
  }
  return true;
}

export function verifyEcdsaSignature(
  publicKeyPem: string,
  payload: Buffer,
  signature: Buffer,
  hashAlgorithm: 'SHA256' | 'SHA384',
): boolean {
  const verify = crypto.createVerify(hashAlgorithm);
  verify.update(payload);
  return verify.verify({ key: publicKeyPem, dsaEncoding: 'ieee-p1363' }, signature);
}

export function bufferFromFixtureHex(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}
