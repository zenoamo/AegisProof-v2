import { IoctlHook } from './ioctl-hook-interface.js';

/**
 * Phase 8.8b deferred ioctl hook.
 *
 * Native module is intentionally not installed.
 * All requests fail with controlled failure until Phase 8.8c+ native hook approval.
 */
export class DeferredIoctlHook implements IoctlHook {
  requestReport(devicePath: string, _reportData?: Buffer): Buffer {
    throw new Error(
      `ioctl native hook not installed for ${devicePath} (Phase 8.8b skeleton — controlled failure)`
    );
  }
}
