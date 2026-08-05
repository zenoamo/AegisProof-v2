# Remote Attestation Flow Design (Research)

> **Design Only** · **PoC Scope** · **Not Production Implementation**

**Phase**: 8.9A (extended from 8.8 initial design)  
**Status**: Architecture Design Only  
**Scope**: No verifier service, no network transport, no production verification

---

## 1. 目的

TEE Evidence の生成から Remote Verifier への伝達、および Attestation ライフサイクルの**責務境界**を固定する。

Phase 8.9A では**設計文書の整理のみ**。実装・ネットワーク・本番検証は対象外。

詳細設計: [Phase 8.9 Remote Attestation Design](../../docs/research/phase8.9-remote-attestation-design.md)

---

## 2. フロー（Phase 8.9A 境界）

```
Evidence Acquisition
        ↓
  [ TdxGuestReader / SevGuestReader / Experimental*Reader ]
  [ AcquisitionFactory — TEE_ACQUISITION flag ]
        ↓
Evidence Parsing
        ↓
  [ tdx-quote-parser / sev-report-parser ]
        ↓
Evidence Normalization
        ↓
  [ RealEvidenceNormalizer — structure-only ]
        ↓
Verification Boundary
  (structure-only stub — NOT production verification)
        ↓
  [ tdx-dcap-verifier-stub / sev-vcek-verifier-stub ]
        ↓
Claims Mapping
  (ZkClaimsMapper — protocol non-contact)
        ↓
  [ zk-claims-mapper ]
        ↓
Attestation Decision Boundary
  (design only — NOT implemented)
        ↓
Future Transport / Service Layer
  (NOT implemented — approval required for Phase 8.9C)
        ↓
  [ Remote Verifier Service ]  ← 未実装
        ↓
  [ Policy Decision ]          ← 未実装
```

---

## 3. Attestation Lifecycle

| 段階 | 説明 | 実装 Phase | Status |
|------|------|------------|--------|
| Acquisition | Guest device から Evidence 取得 | 8.7–8.8b | PoC (placeholder / experimental) |
| Parsing | Quote/Report 構造検証 | 8.6 | PoC |
| Normalization | 構造正規化 | 8.6 | structure-only |
| Verification | 署名・TCB 検証 | 8.8 stub | **structure-only — not production** |
| Claims Mapping | ZK claims 生成 | 8.8 PoC | protocol 非接触 |
| Decision | ポリシー判定 | 8.9A design | **未実装** |
| Transport | ネットワーク送信 | 8.9C+ | **未実装** |
| Remote Verify | オフゲスト検証 | 8.9C+ | **未実装** |

---

## 4. 重要な境界声明

### Verification stub は本番検証ではない

- `TdxDcapVerifierStub` / `SevVcekVerifierStub` は構造検証スタブ。
- DCAP collateral 検証、VCEK チェーン検証、TCB ポリシー判定は**未実装**。
- 本番 Remote Attestation の verification gate として使用**禁止**。
- 実暗号検証は Phase 8.9B（停止条件 — 承認必須）。

### Transport は未実装

- TLS / gRPC / HTTP API / Attestation envelope 送信は**一切未実装**。
- Transport 以降は別 trust domain（設計のみ）。
- 実装は Phase 8.9C Remote Verifier PoC（設計レビュー必須）。

### Production migration は別 Phase 承認制

Production 移行には以下がすべて必要（現状未達）:

1. Linux TEE 実機での Evidence 取得
2. Offline DCAP/VCEK 検証 PoC（Phase 8.9B — 承認必須）
3. Remote Verifier service PoC（Phase 8.9C — 承認必須）
4. Transport threat model レビュー
5. protocol チーム ZK signal レビュー（Phase 8.10 — 承認必須）

---

## 5. Phase 8.9A 禁止事項

*   Verifier サービス実装
*   TLS / gRPC / HTTP transport 実装
*   本番 Attestation Service 接続
*   実運用鍵・証明書
*   DCAP / VCEK 実検証
*   PCCS / KDS 接続
*   `protocol/` / `circuits/` / signal 変更

---

## 6. Trust Boundary / Assumption / Limitation

*   **Trust Boundary (Guest)**: ハードウェア署名付き Evidence が起点。Adapter は verification gate 通過前は production trust を主張しない。
*   **Trust Boundary (Adapter)**: Parser → Normalizer → Stub Verification → Claims Mapper。Mock path とは分離。
*   **Trust Boundary (Verifier)**: Transport 以降の別 domain — **未設計・未実装**。
*   **Trust Boundary (ZK Core)**: `protocol/` 変更禁止。Claims Mapper は protocol 非接触。
*   **Assumption**: Evidence freshness は timestamp + bindingNonce で将来管理（Claims Mapper placeholder）。
*   **Limitation**: structure-only / verification-stub 状態では Remote Attestation **不可**。
*   **Security Consideration**: Replay 防止のため bindingNonce 必須。Transport 実装時に envelope 署名を追加。
*   **Future Implementation Scope**:
    - Phase 8.9B: Offline DCAP/VCEK PoC（停止条件）
    - Phase 8.9C: Remote Verifier + minimal transport（設計レビュー必須）
    - Phase 8.10: ZK Integration（protocol レビュー必須）

---

## 7. 関連ドキュメント

- [Phase 8.9A Master Design](../../docs/research/phase8.9-remote-attestation-design.md)
- [Attestation Flow Design](./attestation-flow-design.md) — Hardware → ZK Core 全体フロー
- [ZK Evidence Integration Design](./zk-evidence-integration-design.md) — ZK 統合境界
- [Verification Policy](./verification-policy.md) — ポリシー設計

---

**Design Only · PoC Scope · Not Production Implementation**
