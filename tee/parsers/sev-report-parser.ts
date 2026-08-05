import { Evidence } from '../mock/provider-interface.js';

export class SevReportParser {
  static parse(buffer: Buffer): Evidence {
    // 1. Report size validation (Assume SEV-SNP report is exactly 1184 bytes min)
    if (!buffer || buffer.length < 1184) {
      throw new Error('Malformed input: SEV-SNP Report buffer too short');
    }

    // 2. Version validation
    // Bytes 0-3 version
    const version = buffer.readUInt32LE(0);
    if (version !== 2) {
      throw new Error(`Malformed input: Unsupported SEV-SNP Report version ${version}`);
    }

    // 3. Signature validation check
    const sigStart = 0x2A0; 
    if (buffer.length < sigStart + 64) {
      throw new Error('Malformed input: Missing signature field in SEV-SNP Report');
    }

    return {
      providerType: 'SEV-SNP',
      rawReport: buffer
    };
  }
}
