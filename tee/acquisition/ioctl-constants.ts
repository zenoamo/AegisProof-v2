/**
 * Phase 8.8b research constants for future native ioctl hooks.
 * Not used for actual kernel calls in this phase.
 */

/** Linux sev-guest: SNP_GET_REPORT — future SNP_GUEST_REQUEST */
export const SEV_GUEST_DEVICE = '/dev/sev-guest';
export const SEV_MIN_REPORT_SIZE = 1184;

/** Linux tdx_guest: TDX_IOC_GET_REPORT0 — future TDCALL path */
export const TDX_GUEST_DEVICE = '/dev/tdx_guest';
export const TDX_MIN_QUOTE_SIZE = 48;
