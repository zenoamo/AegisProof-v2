import { TeeDeviceReader } from './device-reader-interface.js';
import { TdxGuestReader } from './tdx-guest-reader.js';
import { SevGuestReader } from './sev-guest-reader.js';
import { ExperimentalTdxGuestReader } from './experimental-tdx-guest-reader.js';
import { ExperimentalSevGuestReader } from './experimental-sev-guest-reader.js';

/**
 * Phase 8.8b acquisition factory.
 *
 * Default: placeholder readers (Phase 8.7 safe behavior).
 * TEE_ACQUISITION=experimental: experimental ioctl reader skeleton.
 */
export class AcquisitionFactory {
  static getTdxReader(): TeeDeviceReader {
    if (process.env.TEE_ACQUISITION === 'experimental') {
      return new ExperimentalTdxGuestReader();
    }
    return new TdxGuestReader();
  }

  static getSevReader(): TeeDeviceReader {
    if (process.env.TEE_ACQUISITION === 'experimental') {
      return new ExperimentalSevGuestReader();
    }
    return new SevGuestReader();
  }
}
