# AMD SEV-SNP - VCEK Verification Design (Research)

**Phase**: 8.7  
**Status**: Research Design Only  
**Scope**: No KDS connection, no production verification

---

## 1. 目的

AMD SEV-SNP Attestation Report の VCEK 検証フローを Adapter Layer 観点で設計する。Phase 8.7 では**設計のみ**、KDS 接続・実署名検証は Phase 8.8+。

## 2. 検証フロー（設計）

```
SNP Attestation Report (1184 bytes)
    ↓
Report Structure Parse
    ↓
VCEK Certificate Retrieval (KDS)
    ↓
Certificate Chain Validation (ARK → ASK → VCEK)
    ↓
Report Signature Verification (ECDSA P-384)
    ↓
Guest Policy Evaluation
    ↓
Measurement Check (LAUNCH_MEASURE, REPORT_DATA)
```

## 3. Adapter Layer 統合ポイント

| 段階 | コンポーネント | Phase |
|------|----------------|-------|
| 構造検証 | `SevReportParser` | 8.6 ✅ |
| デバイス取得 | `SevGuestReader` | 8.7 ✅ PoC |
| 署名検証 | `SevVcekVerifier`（未実装） | 8.8+ |
| 正規化 | `RealEvidenceNormalizer` | 8.6 ✅ |

## 4. 必要な外部依存（将来）

*   AMD KDS（Key Distribution Service）HTTPS API
*   プロセッサ固有 VCEK（stepping / chip ID 依存）
*   証明書キャッシュ戦略

**Phase 8.7 禁止**: KDS 接続、本番 VCEK 取得、実運用鍵利用

## 5. Guest Policy 評価

*   SMT 有効/無効
*   Migration Policy
*   Debug 禁止
*   REPORT_DATA（64 bytes）への nonce / セッション ID バインド

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: AMD PSP / ASP を Root of Trust とする（将来実装時）。
*   **Assumption**: KDS から取得した VCEK チェーンが真正。
*   **Limitation**: ホスト stepping ごとに VCEK が異なるためキャッシュ設計が必要。
*   **Security Consideration**: Replay 攻撃防止のため REPORT_DATA バインド必須。
*   **Future Implementation Scope**: `tee/verification/sev-vcek-verifier.ts` PoC（Phase 8.8、要承認）。
