# Intel TDX - Real Evaluation Design

## 1. Intel TDX 概要

Intel Trust Domain Extensions (TDX) は、ハイパーバイザ等のホストソフトウェアから仮想マシン（Trust Domain: TD）のメモリと CPU 状態を暗号学的に保護する機能。

## 2. 必要ハードウェア条件
*   Intel 4th Gen Xeon Scalable Processor (Sapphire Rapids) またはそれ以降。
*   Intel TDX Module をロード可能なLinux Kernel（Host/Guest）。

## 3. TDREPORT / Quote生成フロー
1.  **Guest OS**: TD内で `TDCALL [TDG.MR.REPORT]` を発行し `TDREPORT` を取得。
2.  **Quoting Enclave (QE)**: 取得した `TDREPORT` をホスト側のQEに渡し、ECDSA署名された `TD Quote` (フォーマット: v4) を生成。
3.  **Adapter Layer**: この `TD Quote` をバイナリとして受け取り、Evidenceオブジェクトとしてラッピング。

## 4. DCAP検証フロー
1.  Intel Provisioning Certification Enclave (PCE) および PCK Certificate を利用して署名チェーンを検証。
2.  Data Center Attestation Primitives (DCAP) ライブラリを用いて、Quote内のMeasurement（MRTD, RTMR）をAegisProofのポリシーと照合。

## 5. TCB更新時の考慮事項
*   TCB Recovery発生時は新しいPCK証明書が発行されるため、古いQuoteを許容するかどうかのポリシー設定（Freshness）が必要。

## Trust Boundary / Assumption / Limitation
*   **Trust Boundary**: Intel SGX/TDX Quoting Enclave および Intel Key Server (PCS)。
*   **Assumption**: DCAP検証基盤 (PCCS) が正しく構成され、インテルと安全に同期していること。
*   **Limitation**: TEEの起動プロセス（Boot sequence）での測定内容は、ホストプロバイダの構成に強く依存する。
*   **Security Consideration**: CPUの脆弱性公開に伴う緊急のTCB更新（マイクロコードパッチ）へのダウンタイム対応。
*   **Future Implementation Scope**: AWS EC2 m7i などのTDXインスタンス上での実証。
