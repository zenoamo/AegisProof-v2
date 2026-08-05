# ZK Evidence Integration Design (Research)

**Phase**: 8.7  
**Status**: Research Design Only  
**Scope**: No protocol/circuit changes, no production integration

---

## 1. 目的

TEE Adapter Layer が生成・正規化した Evidence を、AegisProof ZK Verification Layer へ接続する際の**統合境界**を設計する。

**重要**: `protocol/`, `circuits/`, `crypto-artifacts/`, `formal/` への変更は Phase 8.7 スコープ外。本設計は境界定義のみ。

## 2. 統合アーキテクチャ（設計）

```
[ TEE Hardware ]
      ↓
[ Acquisition Layer ]     ← Phase 8.7
      ↓
[ Parser / Provider ]
      ↓
[ RealEvidenceNormalizer ] ← structure-only (Phase 8.6)
      ↓
[ Verification Layer ]     ← DCAP/VCEK (Phase 8.8+)
      ↓
[ ZK Input Mapper ]        ← 本設計（未実装）
      ↓
[ AegisProof ZK Core ]     ← 既存 protocol v2（変更禁止）
```

## 3. ZK Input Mapping（設計案）

| TEE フィールド | ZK 入力候補 | 備考 |
|----------------|-------------|------|
| Measurement (MRTD / SNP MEASURE) | `tee_measurement_hash` | ポリシー一致確認 |
| Report Data / User Data | `tee_binding_nonce` | Replay 防止 |
| Provider Type | `tee_provider_id` | TDX / SEV-SNP 識別 |
| pocScope | メタデータのみ | 本番では `verified` に置換 |

**Phase 8.7 禁止**: signal 定義変更、回路変更、zkey/vkey 再生成

## 4. 統合モード（将来）

| モード | 説明 |
|--------|------|
| ZK Only | 既存 AegisProof v2（TEE 非依存） |
| ZK + TEE | ZK 検証 + TEE Measurement 一致確認 |
| TEE Assisted | TEE 内計算 + ZK 証明（将来研究） |

## 5. 統合前提条件

*   `RealEvidenceNormalizer` が `pocScope: 'structure-only'` から署名検証済み状態へ昇格
*   DCAP / VCEK 検証 PoC 完了（Phase 8.8+）
*   protocol チームによる signal 拡張レビュー（別途必須）

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: ZK Core は変更しない。TEE 統合は Adapter 外側のオプション層。
*   **Assumption**: TEE Measurement と ZK 公開入力のバインドが暗号学的に意味を持つ。
*   **Limitation**: structure-only PoC 状態では ZK 統合不可。
*   **Security Consideration**: TEE 検証失敗時の ZK-only フォールバック必須。
*   **Future Implementation Scope**: `tee/integration/zk-input-mapper.ts` PoC（protocol レビュー後）。
