# Phase 8.8b - Experimental Ioctl Acquisition PoC (Skeleton)

## 1. 目的

Phase 8.8 の ioctl 研究設計を、**native 依存なし**の experimental acquisition skeleton として実装する。

`TEE_ACQUISITION=experimental` 時のみ experimental reader を有効化し、デフォルトは Phase 8.7 placeholder を維持する。

## 2. 実装範囲

| コンポーネント | 役割 |
|----------------|------|
| `IoctlHook` | 将来 native hook の interface |
| `DeferredIoctlHook` | controlled failure（native 未インストール） |
| `ExperimentalTdxGuestReader` | Linux + device チェック → hook 委譲 |
| `ExperimentalSevGuestReader` | 同上 |
| `AcquisitionFactory` | `TEE_ACQUISITION` による reader 選択 |

## 3. Feature Flag

```
TEE_ACQUISITION 未設定
        ↓
TdxGuestReader / SevGuestReader（placeholder — デフォルト）

TEE_ACQUISITION=experimental
        ↓
ExperimentalTdxGuestReader / ExperimentalSevGuestReader
        ↓
DeferredIoctlHook → controlled failure（native hook 未インストール）
```

## 4. 意図的スコープ外

*   native module / ioctl npm パッケージ
*   実 SNP_GUEST_REQUEST / TDCALL 呼び出し
*   DCAP / VCEK 検証
*   PCCS / KDS 接続
*   protocol 変更

## 5. Phase 8.8c 移行条件（要承認）

*   native ioctl hook 依存の追加承認
*   Linux 実機での end-to-end Quote/Report 取得 PoC
*   オフライン DCAP/VCEK 検証

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: experimental reader は guest device パスまで。署名検証なし。
*   **Assumption**: controlled failure は正常系（skeleton フェーズ）。
*   **Limitation**: Windows CI では experimental path は Linux guard で終了。
*   **Security Consideration**: デフォルト placeholder 維持。Production 利用禁止。
*   **Future Implementation Scope**: `NativeIoctlHook`（Phase 8.8c、native 依存承認後）。
