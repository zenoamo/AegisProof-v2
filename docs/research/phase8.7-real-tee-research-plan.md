# Phase 8.7 - Real TEE Research Plan

## 1. 目的

Phase 8.6 で確立した Attestation Adapter Architecture を基に、実 TEE Evidence 取得・暗号検証・ZK 統合の**研究設計と PoC 拡張**を行う。

本フェーズは Research / PoC スコープであり、Production TEE 統合・外部サービス実接続・protocol 変更は対象外。

## 2. 実装候補と Phase 8.7 対応

| 候補 | Phase 8.7 対応 | 種別 |
|------|----------------|------|
| A. Real TEE Evidence Acquisition | `tee/acquisition/*` PoC 実装 | コード |
| B. Intel DCAP Verification Research | `tee/intel-tdx/dcap-verification-design.md` | 設計 |
| C. AMD VCEK Verification Research | `tee/amd-sev-snp/vcek-verification-design.md` | 設計 |
| D. ZK Layer Integration Design | `tee/integration/zk-evidence-integration-design.md` | 設計 |

## 3. Phase 8.7 PoC 実装（候補 A）

### Device Acquisition Layer

```
TdxProvider / SevSnpProvider
        ↓
TdxGuestReader / SevGuestReader
        ↓
/dev/tdx_guest / /dev/sev-guest
```

*   デバイス存在確認 + readable チェック
*   不存在時 controlled failure（Phase 8.6 互換）
*   **ioctl / SNP_GUEST_REQUEST / TDCALL は未実装**（研究 placeholder）

## 4. PoC 制限事項（Phase 8.7 継続）

*   Intel DCAP / AMD KDS への**実接続なし**
*   暗号署名検証の**実装なし**（設計のみ）
*   Remote Attestation なし
*   ZK Layer への**実統合なし**（設計のみ）
*   protocol / circuits / crypto-artifacts / formal **非変更**

## 5. Security Boundary

Phase 8.7 も `tee/` および `docs/` 配下のみ変更。Security Boundary 保護対象への変更ゼロ。

## 6. Phase 8.8 以降への移行条件

*   Linux 実機での ioctl ベース Quote/Report 取得 PoC
*   DCAP / VCEK 検証ライブラリ統合（要承認）
*   AegisProof ZK Verification Layer 接続（protocol レビュー必須）

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: Device acquisition は guest デバイスノードまで。ハードウェア Root of Trust 検証は未実装。
*   **Assumption**: デバイスノード存在は TEE 有効環境の必要条件だが、十分条件ではない。
*   **Limitation**: Windows 開発環境では device unavailable が正常系。
*   **Security Consideration**: 外部 PCCS/KDS 接続は Phase 8.8+ で別途承認。
*   **Future Implementation Scope**: ioctl 実装、DCAP/VCEK 検証 PoC、ZK 統合 PoC。
