/**
 * Phase 8.7 PoC device acquisition interface.
 *
 * Research/PoC only. Full ioctl-based guest requests are not implemented.
 * Production use is prohibited.
 */
export interface TeeDeviceReader {
  readonly devicePath: string;

  isAvailable(): boolean;

  /**
   * Acquire raw attestation bytes from the guest device path.
   * Throws controlled failure when device is unavailable.
   */
  acquireRawReport(reportData?: Buffer): Buffer;
}
