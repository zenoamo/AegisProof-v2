# Phase 8.6 - Real TEE Integration PoC

## 1. 目的

Phase 8.5 で設計した Intel TDX / AMD SEV-SNP Attestation Adapter Layer を、研究・評価目的の PoC として実装し、TEE Attestation Adapter Architecture の妥当性を検証する。

本フェーズは **TEE Attestation Adapter Architecture Validation PoC** であり、本番 TEE 統合・Production Deployment ではない。

## 2. 対象範囲

*   TDX Quote / SEV-SNP Report の構造バリデーション（Parser 層）
*   Real Provider 骨格（デバイス存在確認 + controlled failure）
*   Mock / Real Provider 切替（ProviderFactory + TEE_ENV）
*   Mock / Real Evidence 正規化層の責務分離
*   評価パイプライン統合（`tee/scripts/evaluate.ts`）

## 3. 実装済みコンポーネント

### Commit 1: PoC Skeleton

| コンポーネント | ファイル | 役割 |
|----------------|----------|------|
| TDX Quote Parser | `tee/parsers/tdx-quote-parser.ts` | Quote v4 構造検証（最低 48 byte） |
| SEV Report Parser | `tee/parsers/sev-report-parser.ts` | Report v2 構造検証（1184 byte） |
| TDX Provider | `tee/providers/tdx-provider.ts` | `/dev/tdx_guest` 存在確認 + controlled failure |
| SEV-SNP Provider | `tee/providers/sev-snp-provider.ts` | `/dev/sev-guest` 存在確認 + controlled failure |
| ProviderFactory | `tee/providers/provider-factory.ts` | TEE_ENV による Mock/Real 切替 |
| Real PoC Tests | `tee/tests/real-tdx-poc.test.ts`, `real-sev-poc.test.ts` | Parser + Provider 検証 |

### Commit 2: Factory Integration + Real Normalizer

| コンポーネント | ファイル | 役割 |
|----------------|----------|------|
| EvidenceGenerator | `tee/mock/evidence-generator.ts` | ProviderFactory 委譲（Mock 固定ラッパー） |
| RealEvidenceNormalizer | `tee/normalizers/real-evidence-normalizer.ts` | Real Evidence 構造正規化 |
| Factory Test | `tee/tests/provider-factory.test.ts` | TEE_ENV 切替検証 |
| Normalizer Test | `tee/tests/real-evidence-normalizer.test.ts` | Real/Mock 分離検証 |

### Commit 3: Documentation + Evaluation Pipeline

| コンポーネント | ファイル | 役割 |
|----------------|----------|------|
| Evaluation Pipeline | `tee/scripts/evaluate.ts` | Stage A (Mock) + Stage B (Real PoC) |
| Design Document | `docs/research/phase8.6-real-tee-poc.md` | 本ドキュメント |
| README | `tee/README.md` | 現行構造の反映 |

## 4. PoC 制限事項

以下は Phase 8.6 スコープ外として意図的に未実装:

*   **暗号署名検証なし** — `verifyEvidence()` は PoC stub（構造検証のみ）
*   **Intel DCAP 未実装** — Quote Service / PCCS 接続なし
*   **AMD VCEK 未実装** — KDS 接続・証明書取得なし
*   **Remote Attestation 未実装** — ネットワーク経由の Attestation なし
*   **Production 統合なし** — AegisProof ZK Verification Layer への接続なし
*   **実デバイス I/O なし** — ioctl/read による Quote/Report 取得なし

## 5. Security Boundary 保護確認

Phase 8.6 全 commit（1 + 2 + 3）を通じて、以下への変更はゼロ:

*   `protocol/`
*   `protocol/circuits/`
*   `protocol/specs/`
*   `crypto-artifacts/`
*   `formal/`

ZK 回路、signal 定義、zkey/vkey、Trusted Setup 成果物、本番スマートコントラクトには一切触れていない。

## 6. 評価

### Stage A: Phase 8.4 Mock Evaluation

*   Functional / Security / Performance 評価（Mock Provider + Mock Normalizer）

### Stage B: Phase 8.6 Real TEE PoC Evaluation

*   TDX / SEV-SNP Parser + Provider PoC
*   ProviderFactory TEE_ENV 切替
*   RealEvidenceNormalizer 構造正規化

実行:

```bash
npx tsx tee/scripts/evaluate.ts
```

## 7. Phase 8.7 以降への移行条件

以下は Phase 8.7+ で別途設計・承認が必要:

*   実 TEE デバイスからの ioctl/read による Quote/Report 取得
*   Intel DCAP 署名検証の実装
*   AMD VCEK 署名検証の実装
*   Remote Attestation（ネットワーク経由）
*   AegisProof ZK Verification Layer との統合
*   Production Deployment

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: Phase 8.6 PoC は `tee/` 研究領域内に限定。ハードウェア Root of Trust までの検証は未実装。
*   **Assumption**: Parser 構造検証が通過した Evidence は「形式上妥当」であるが、暗号学的真正性は保証しない。
*   **Limitation**: Windows 等デバイス非存在環境では controlled failure が正常系。実機検証は Linux + TDX/SEV ハードウェアが必要。
*   **Security Consideration**: `verifyEvidence()` の PoC stub は本番利用禁止。Production 統合前に DCAP/VCEK 実検証が必須。
*   **Future Implementation Scope**: Phase 8.7 で実デバイス I/O + 暗号検証の設計・承認。
