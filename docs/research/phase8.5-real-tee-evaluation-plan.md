# Phase 8.5 - Real TEE Evaluation Plan

## 1. 実TEE評価目的
Phase 8.4のMock環境評価で検証したAdapter Layerアーキテクチャを基に、実世界のハードウェア（Intel TDX / AMD SEV-SNP）で稼働させるための準備・設計を行う。実機特有の制約、Attestation取得フロー、および検証ポリシーを整理する。

## 2. 評価範囲
*   Intel TDX における Quote 生成と DCAP 検証フローの設計。
*   AMD SEV-SNP における Attestation Report 生成と VCEK 検証フローの設計。
*   TEE Hardware Root of Trust から ZK Verification Layer へ至る Attestation Flowの定義。
*   (※実機の調達や実機でのコード実装・実行は本フェーズ（Phase 8.5）では行わない)

## 3. 環境要件
*   **Intel TDX**: 第4世代以降の Xeon Scalable Processor (Sapphire Rapids 以降) 搭載ホスト。DCAP対応のKBS/PCCS構成。
*   **AMD SEV-SNP**: EPYC 7003 (Milan) 以降のプロセッサ搭載ホスト。AMD KDS (Key Distribution Service) との通信。

## 4. Phase 8.6への移行条件
*   各ハードウェアTEE（TDX, SEV-SNP）のAttestationデータ構造と要件が完全に文書化されること。
*   実機統合のための環境準備計画が策定され、ブロック要因が特定されていること。
*   AegisProofの既存プロトコル（v2）およびSecurity Boundaryに一切変更を加えないアーキテクチャが保証されていること。

## Trust Boundary / Assumption / Limitation
*   **Trust Boundary**: TEEのハードウェア設計およびCPUベンダー（Intel, AMD）の証明書インフラストラクチャをRoot of Trustとする。
*   **Assumption**: 各ベンダーが提供する署名鍵（PCK, VCEK）が正しく管理されており、危殆化していないこと。
*   **Limitation**: パブリッククラウド（AWS/Azure）での実行時は、CSP固有のハイパーバイザ実装に依存する可能性がある。
*   **Security Consideration**: サイドチャネル攻撃など、ハードウェアレベルの脆弱性にはTEE本体のファームウェアアップデートが必要となる。
*   **Future Implementation Scope**: Phase 8.6での実機セットアップおよびPoC動作検証。
