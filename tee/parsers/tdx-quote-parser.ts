import { Evidence } from '../mock/provider-interface.js';

export class TdxQuoteParser {
  static parse(buffer: Buffer): Evidence {
    // 1. Buffer length validation (Assume a valid quote is at least 48 bytes)
    if (!buffer || buffer.length < 48) {
      throw new Error('Malformed input: TDX Quote buffer too short');
    }

    // 2. Header & Version validation
    // Bytes 0-1 are version
    const version = buffer.readUInt16LE(0);
    if (version !== 4) {
      throw new Error(`Malformed input: Unsupported TDX Quote version ${version}`);
    }

    return {
      providerType: 'TDX',
      rawReport: buffer
    };
  }
}
