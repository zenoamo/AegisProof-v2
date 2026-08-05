# Intel TDX - DCAP Verification Design (Research)

**Phase**: 8.7  
**Status**: Research Design Only  
**Scope**: No PCCS connection, no production verification

---

## 1. 目的

Intel TDX Quote の DCAP（Data Center Attestation Primitives）検証フローを Adapter Layer 観点で設計する。Phase 8.7 では**設計のみ**、実装・PCCS 接続は Phase 8.8+。

## 2. 検証フロー（設計）

```
TD Quote (raw)
    ↓
Quote Header / Body Parse
    ↓
QE Identity Verification
    ↓
PCK Certificate Chain Validation (ARK → ASK → PCK)
    ↓
Quote Signature Verification (ECDSA P-256)
    ↓
TCB Status Evaluation (QvE / PCS)
    ↓
Measurement Policy Check (MRTD, RTMR[])
```

## 3. Adapter Layer 統合ポイント

| 段階 | コンポーネント | Phase |
|------|----------------|-------|
| 構造検証 | `TdxQuoteParser` | 8.6 ✅ |
| デバイス取得 | `TdxGuestReader` | 8.7 ✅ PoC |
| 署名検証 | `TdxDcapVerifier`（未実装） | 8.8+ |
| 正規化 | `RealEvidenceNormalizer` | 8.6 ✅ |

## 4. 必要な外部依存（将来）

*   Intel DCAP ライブラリ / Quote Verification Library
*   PCCS（Provisioning Certificate Caching Service）
*   _collateral_ 更新（CRL, TCB Info）

**Phase 8.7 禁止**: PCCS URL 設定、ネットワーク接続、本番証明書利用

## 5. TCB 評価考慮事項

*   TCB Recovery 時の Quote 鮮度ポリシー
*   Security Advisory による Quote 失効
*   `tcbStatus` を `RealEvidenceNormalizer` から `Verified` に昇格する条件定義

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: Intel SGX QE / PCS を Root of Trust とする（将来実装時）。
*   **Assumption**: PCCS が最新 collateral を提供する。
*   **Limitation**: クラウド CSP 固有の Quote 拡張フィールドへの対応が必要な場合あり。
*   **Security Consideration**: オフライン検証 vs オンライン collateral 取得のトレードオフ。
*   **Future Implementation Scope**: `tee/verification/tdx-dcap-verifier.ts` PoC（Phase 8.8、要承認）。
