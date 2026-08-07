# Attestation Flow Design

## 1. 目的

Intel TDX および AMD SEV-SNP の実機環境から取得したハードウェア証拠（Evidence）が、AegisProof の Verification Layer まで安全に伝達・検証されるまでのデータフローと信頼境界（Trust Boundary）を定義する。

## 2. Attestation Flow と信頼境界

全体フローとコンポーネント間の連携:

```text
[ TEE Hardware Root of Trust ]  (Intel / AMD Hardware)
             ↓
[ TEE Measurement ]             (Hardware generates cryptographically signed report)
             ↓
[ Attestation Evidence ]        (Raw TD Quote / SNP Report generated in Guest)
             ↓
[ TEE Adapter Layer ]           (Abstracts vendor specifics, Evidence Normalization)
             ↓
[ Verification Policy ]         (Evaluates ZK + TEE composite rules, checks TCB)
             ↓
[ ZK Verification Layer ]       (Existing AegisProof v2 core verification)
             ↓
[ Application ]                 (Consumes final verification result)
```

## 3. Adapter Layer のベンダー非依存設計

Adapter Layer は以下の方針で Intel TDX と AMD SEV-SNP の固有ロジックを分離する。両者を直接統合・交差させない。

```text
[ TDX Provider ] ──┐
                   │
           [ TeeProvider Interface ]
                   │
[ SEV-SNP Provider ] ──┘
```

## Trust Boundary / Assumption / Limitation
*   **Trust Boundary**: ハードウェア(CPU)から出力された時点での署名付きEvidenceが起点となり、Adapter Layer以降は信頼されたソフトウェアとして機能する。
*   **Assumption**: TEE Measurementに含まれるUser Data領域を利用して、ZK ProofとTEE Attestationのコンテキストが暗号学的にバインドされていること。
*   **Limitation**: 異なるTEE環境を跨いだProofの透過的検証には、Normalizationのスキーマ設計への強い依存が存在する。
*   **Security Consideration**: Adapter LayerとVerification Policy間でのメモリ改ざんを防ぐため、同一のセキュアなプロセス（またはTEE内）で実行されることが望ましい。
*   **Future Implementation Scope**: Phase 8.6での統合テスト基盤の構築およびインテグレーションコードの実装。
