import fs from 'fs';
import { TeeDeviceReader } from './device-reader-interface.js';
import { DeferredIoctlHook } from './deferred-ioctl-hook.js';
import { IoctlHook } from './ioctl-hook-interface.js';
import { SEV_GUEST_DEVICE } from './ioctl-constants.js';

/**
 * Phase 8.8b experimental SEV-SNP guest reader.
 *
 * Opt-in via TEE_ACQUISITION=experimental.
 * Native ioctl is not installed; requests fail with controlled failure.
 * Production use is prohibited.
 */
export class ExperimentalSevGuestReader implements TeeDeviceReader {
  readonly devicePath = SEV_GUEST_DEVICE;
  private readonly hook: IoctlHook;

  constructor(hook: IoctlHook = new DeferredIoctlHook()) {
    this.hook = hook;
  }

  isAvailable(): boolean {
    return process.platform === 'linux' && fs.existsSync(this.devicePath);
  }

  acquireRawReport(reportData?: Buffer): Buffer {
    if (process.platform !== 'linux') {
      throw new Error('experimental acquisition requires Linux (controlled failure)');
    }

    if (!fs.existsSync(this.devicePath)) {
      throw new Error(`device unavailable: ${this.devicePath} not found (controlled failure)`);
    }

    return this.hook.requestReport(this.devicePath, reportData);
  }
}
