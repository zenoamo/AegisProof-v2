import fs from 'fs';
import { TeeDeviceReader } from './device-reader-interface.js';

const SEV_GUEST_DEVICE = '/dev/sev-guest';
const MIN_REPORT_SIZE = 1184;

/**
 * Phase 8.7 PoC SEV-SNP guest device reader.
 *
 * Full SNP_GUEST_REQUEST ioctl is not implemented.
 * When the device node exists, returns a parser-valid research placeholder.
 */
export class SevGuestReader implements TeeDeviceReader {
  readonly devicePath = SEV_GUEST_DEVICE;

  isAvailable(): boolean {
    return fs.existsSync(this.devicePath);
  }

  acquireRawReport(_reportData?: Buffer): Buffer {
    if (!this.isAvailable()) {
      throw new Error(`device unavailable: ${this.devicePath} not found (controlled failure)`);
    }

    this.assertReadableDeviceNode();

    const report = Buffer.alloc(MIN_REPORT_SIZE);
    report.writeUInt32LE(2, 0);
    return report;
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
