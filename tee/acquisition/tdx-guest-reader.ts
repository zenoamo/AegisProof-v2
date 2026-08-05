import fs from 'fs';
import { TeeDeviceReader } from './device-reader-interface.js';

const TDX_GUEST_DEVICE = '/dev/tdx_guest';
const MIN_QUOTE_SIZE = 48;

/**
 * Phase 8.7 PoC TDX guest device reader.
 *
 * Full TDCALL/ioctl quote generation is not implemented.
 * When the device node exists, returns a parser-valid research placeholder.
 */
export class TdxGuestReader implements TeeDeviceReader {
  readonly devicePath = TDX_GUEST_DEVICE;

  isAvailable(): boolean {
    return fs.existsSync(this.devicePath);
  }

  acquireRawReport(_reportData?: Buffer): Buffer {
    if (!this.isAvailable()) {
      throw new Error(`device unavailable: ${this.devicePath} not found (controlled failure)`);
    }

    this.assertReadableDeviceNode();

    const quote = Buffer.alloc(MIN_QUOTE_SIZE);
    quote.writeUInt16LE(4, 0);
    return quote;
  }

  private assertReadableDeviceNode(): void {
    try {
      const fd = fs.openSync(this.devicePath, 'r');
      fs.closeSync(fd);
    } catch {
      throw new Error(
        `device read failed: ${this.devicePath} present but not readable (ioctl acquisition deferred)`
      );
    }
  }
}
