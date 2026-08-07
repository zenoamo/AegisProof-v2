# AMD SEV-SNP - Real Evaluation Design

## 1. AMD SEV-SNP 概要

Secure Encrypted Virtualization-Secure Nested Paging (SEV-SNP) は、AMD EPYC プロセッサによるメモリ暗号化技術。ハイパーバイザによるメモリの不正書き込みやリプレイ攻撃から VM を保護する。

## 2. 必要ハードウェア条件
*   AMD EPYC 7003 (Milan) 世代またはそれ以降。
*   SNP対応のKVMおよびGuest Kernel (Linux 5.19+)。

## 3. Attestation Report生成
1.  **Guest OS**: ゲスト内から `/dev/sev-guest` デバイスに対して `SNP_GUEST_REQUEST` (MSG_REPORT_REQ) を発行。
2.  **Hardware (PSP)**: Platform Security Processor (PSP) がMeasurementと指定されたReport Data（nonceや公開鍵）を結合し、VCEKで署名した `Attestation Report` を返す。
3.  **Adapter Layer**: Reportをパースし、Evidenceオブジェクトに格納する。

## 4. VCEK検証フロー
1.  AMD KDS (Key Distribution Service) からプロセッサ固有のVCEK（Versioned Chip Endorsement Key）証明書を取得。
2.  Reportの署名を検証し、Measurement (`LDATA`, `MEASURE`) をAegisProofの期待値と照合。

## 5. Guest Policy評価項目
*   SMT (Simultaneous Multithreading) の有効/無効状態がポリシー要件に合致しているか確認（サイドチャネル攻撃緩和のためSMT無効を強制するか等）。
*   Migration Policyの制限設定。

## Trust Boundary / Assumption / Limitation
*   **Trust Boundary**: AMD Platform Security Processor (PSP) / AMD Secure Processor (ASP)。
*   **Assumption**: AMD KDS へのアクセス経路がセキュアであり、取得した証明書チェーンが真正であること。
*   **Limitation**: ホストマシンの特定のステッピング/ファームウェアバージョンごとにVCEKが異なるため、証明書のキャッシング設計が必要。
*   **Security Consideration**: SNP Reportに埋め込むReport Data (64 bytes) に、AegisProofのセッションIDや一時公開鍵をバインドしてReplay攻撃を防ぐこと。
*   **Future Implementation Scope**: Azure Confidential VMs などのSEV-SNPインスタンスでの実証。
