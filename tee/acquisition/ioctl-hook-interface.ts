/**
 * Phase 8.8b ioctl hook interface.
 *
 * Native ioctl implementation is deferred.
 * Production use is prohibited.
 */
export interface IoctlHook {
  requestReport(devicePath: string, reportData?: Buffer): Buffer;
}
