# ioctl Acquisition Design (Research)

**Phase**: 8.8  
**Status**: Research Design Only  
**Scope**: No ioctl implementation in Phase 8.8

---

## 1. 目的

Phase 8.7 の Device Acquisition 層を、Linux guest デバイスからの**実バイナリ取得**へ拡張するための研究設計。Phase 8.8 では**設計のみ**、実 ioctl 呼び出しは Phase 8.8b（要承認）。

## 2. 対象デバイス

| TEE | デバイス | Guest 操作 |
|-----|----------|------------|
| Intel TDX | `/dev/tdx_guest` | TDCALL / ioctl 経由 TDREPORT → Quote |
| AMD SEV-SNP | `/dev/sev-guest` | SNP_GUEST_REQUEST (MSG_REPORT_REQ) |

## 3. 設計方針

```
TeeDeviceReader (interface)
        ↓
IoctlDeviceReader (Phase 8.8b — 未実装)
        ↓
/dev/tdx_guest | /dev/sev-guest
```

Phase 8.7 `TdxGuestReader` / `SevGuestReader` は placeholder 返却。Phase 8.8b で ioctl 実装に差し替え。

## 4. Phase 8.8 禁止

*   `fs.ioctl` / native addon による ioctl 呼び出し
*   本番 TEE デバイス操作
*   Linux 以外を必須とする CI 変更

## 5. Phase 8.8b 前提条件

*   Linux 実機（TDX または SEV-SNP guest）
*   カーネル guest driver 有効
*   明示的な停止条件レビュー承認

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: ioctl 成功は guest driver まで。ハードウェア署名検証は Verification 層。
*   **Assumption**: デバイスノード read 可能 ≠ 有効な Quote/Report 取得可能。
*   **Limitation**: Windows/macOS 開発環境では controlled failure が正常系。
*   **Security Consideration**: ioctl 実装は Production TEE 操作に該当 → 別承認必須。
*   **Future Implementation Scope**: `tee/acquisition/ioctl-guest-reader.ts`（Phase 8.8b）。
