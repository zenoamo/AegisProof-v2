# Remote Attestation Flow Design (Research)

**Phase**: 8.8  
**Status**: Research Design Only  
**Scope**: No verifier service, no network transport implementation

---

## 1. 目的

TEE Evidence の生成から検証者への伝達、および Attestation ライフサイクルを設計する。Phase 8.8 では**設計のみ**。

## 2. フロー（設計）

```
[ TEE Guest ]
      ↓ acquire
[ Raw Quote / Report ]
      ↓ parse + normalize
[ RealEvidenceNormalizer ]
      ↓ verify (stub → future DCAP/VCEK)
[ Verification Layer ]
      ↓ map
[ ZkClaimsMapper ]
      ↓ (future) transport
[ Remote Verifier Service ]  ← 未実装
      ↓
[ Policy Decision ]
```

## 3. Attestation Lifecycle（設計）

| 段階 | 説明 | Phase |
|------|------|-------|
| Generate | Guest device から Evidence 取得 | 8.7 PoC |
| Normalize | 構造正規化 | 8.6 ✅ |
| Verify | 署名・TCB 検証 | 8.8 stub |
| Map | ZK claims 生成 | 8.8 PoC |
| Transport | ネットワーク送信 | 8.9+ |
| Decide | ポリシー判定 | 8.9+ |

## 4. Phase 8.8 禁止事項

*   Verifier サービス実装
*   TLS / gRPC transport
*   本番 Attestation Service 接続
*   実運用鍵・証明書

## Trust Boundary / Assumption / Limitation

*   **Trust Boundary**: Transport 以降は別 trust domain（未設計）。
*   **Assumption**: Evidence freshness は timestamp + nonce バインドで将来管理。
*   **Limitation**: structure-only / verification-stub 状態では Remote Attestation 不可。
*   **Security Consideration**: Replay 防止のため bindingNonce 必須（ZkClaimsMapper PoC で placeholder）。
*   **Future Implementation Scope**: Phase 8.9+ Verifier service PoC（要承認）。
