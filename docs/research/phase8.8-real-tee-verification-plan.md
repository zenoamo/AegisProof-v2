# Phase 8.8 - Real TEE Verification Research Plan

## 1. 目的

Phase 8.7 の Device Acquisition PoC と検証設計を基に、DCAP/VCEK 検証層の**スタブ実装**および ZK claims マッピング PoC を追加する。

本フェーズは Research / PoC スコープ。Production 暗号検証・外部サービス接続・protocol 変更は対象外。

## 2. Phase 8.8 実装範囲

| 項目 | 内容 | 種別 |
|------|------|------|
| Verification Stubs | `tee/verification/*` DCAP/VCEK 構造検証スタブ | コード |
| ZK Claims Mapper | `tee/integration/zk-claims-mapper.ts` | コード |
| Remote Attestation Design | `tee/integration/remote-attestation-flow-design.md` | 設計 |
| ioctl Research Design | `tee/acquisition/ioctl-acquisition-design.md` | 設計 |
| Evaluation Stage D | `tee/scripts/evaluate.ts` | 評価 |

## 3. 意図的スコープ外

*   ioctl / TDCALL / SNP_GUEST_REQUEST **実装**
*   Intel DCAP / AMD KDS **実接続**
*   本番暗号署名検証
*   Remote Attestation **サービス実装**
*   `protocol/` / `circuits/` / signal 変更

## 4. Security Boundary

Phase 8.8 も `tee/` および `docs/` のみ変更。

## 5. Phase 8.8b 移行条件（要承認）

*   Linux 実機 ioctl PoC
*   オフライン DCAP/VCEK 検証（テストベクター）
*   protocol チームによる ZK signal 拡張レビュー

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: Verification stub は構造検証のみ。ハードウェア Root of Trust 未検証。
*   **Assumption**: Claims mapper 出力は research artifact であり ZK 入力としては未承認。
*   **Limitation**: `pocScope: verification-stub` / `claims-mapper-poc` は本番 gate に使用不可。
*   **Security Consideration**: PCCS/KDS 接続は Phase 8.8b+ で別途停止条件レビュー。
*   **Future Implementation Scope**: 実 ioctl、オフライン暗号検証、protocol 統合。
