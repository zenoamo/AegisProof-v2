# Phase 8.2 - TEE Adapter Layer Evaluation Framework

## 1. 評価目的

本ドキュメントは、AegisProof Phase 8.1 で設計された TEE Adapter Layer の PoC 実装（Phase 8.3 以降を予定）に先立ち、評価基準と成功基準を明確化するものです。何を測定し、どの結果が得られれば機能要件およびセキュリティ要件を満たしたと判断するか（Go/No-Go）を定義します。

## 2. 評価アーキテクチャ
本評価フレームワークは、以下の3層で構成されます。
*   **Adapter Layer**: インターフェース抽象化とプロバイダ管理
*   **Attestation 処理**: 各TEEプロバイダ固有の証拠（Evidence）の検証と正規化
*   **Verification Policy**: ZKとTEEの組み合わせポリシーの実行

※本評価はMockプロバイダ（Intel TDX Mock / AMD SEV-SNP Mock）を用いて実施し、実ハードウェアへの接続は行いません。

## 3. Test Matrix

### 3.1. Adapter Layer
| テスト項目 | 内容 |
| :--- | :--- |
| Interface設計の妥当性 | 定義された共通インターフェースで異なるTEEプロバイダを操作可能か |
| Provider抽象化 | アプリケーション側が基盤ハードウェアを意識せずに動作するか |
| Error Handling | プロバイダ固有のエラーが共通のエラーフォーマットに適切にマッピングされるか |
| 拡張性 | 新規プロバイダ（例: AWS Nitro Enclaves Mock）の追加が既存コードの変更なく可能か |

### 3.2. Attestation 処理
| テスト項目 | 内容 |
| :--- | :--- |
| TDX Quote Mock処理 | Intel TDX形式のMock Quoteの生成・パース・署名検証が正しく行われるか |
| SEV-SNP Report Mock処理 | AMD SEV-SNP形式のMock Reportの生成・パース・署名検証が正しく行われるか |
| Evidence Normalization | 異なる形式のAttestation Reportが、AegisProof標準の証拠フォーマットに正規化されるか |
| 検証失敗時の処理 | 無効な署名や期限切れのReportが正確にリジェクトされるか |

### 3.3. Verification Policy
| テスト項目 | 内容 |
| :--- | :--- |
| ZK Onlyモード | TEEを使用せず、ゼロ知識証明のみで検証がパス・フェイルすること |
| ZK + TEEモード | ZKの証明とTEEのAttestationの両方が有効な場合のみパスすること |
| Dual Providerモード | TDXとSEV-SNP両方のAttestationを同時に要求・検証できること |
| Fallback動作 | TEEが利用不可能な場合に、安全な代替手段（または明示的拒否）にフォールバックすること |

## 4. Functional Criteria (機能要件)
1. すべてのMockプロバイダに対するAPI呼び出しが正常に完了すること。
2. 正規化されたEvidenceのスキーマがv2プロトコル拡張仕様（Draft）に完全に準拠すること。
3. ZK + TEEポリシー設定時、どちらか一方でも無効な場合は最終検証が確実に失敗すること。

## 5. Security Criteria (セキュリティ要件)
Threat Modelに基づき、以下のシナリオでシステムが安全側に倒れる（フェイルセーフ）ことを確認します。
1. **偽造Evidence**: 不正な署名キーで生成されたQuote/Reportの拒否。
2. **改ざんEvidence**: 転送中に一部のビットが反転・改ざんされたReportの拒否。
3. **Provider障害**: 1つのプロバイダがダウンした場合、エラーハンドリングによりシステム全体がクラッシュしないこと。
4. **Timeout**: Attestation応答が指定時間（例: 5000ms）を超えた場合の適切なタイムアウト処理と検証失敗。
5. **Configuration Drift**: 不正な設定（未許可の測定値、古いTCBバージョン）を持つReportの拒否。

## 6. Performance Metrics
以下の指標を測定します（Mock環境でのベースライン）。
*   **Adapter Overhead**: ネイティブAPI呼び出しに対するAdapter Layerの処理遅延（目標: < 10ms）
*   **Normalization Time**: Evidence正規化にかかる時間（目標: < 5ms）
*   **Policy Evaluation**: Verification Policyの評価時間（目標: < 2ms）

## 7. Failure Scenarios
テスト時には意図的に以下の障害を発生させ、回復性または安全な停止を確認します。
*   Mockプロバイダの突然のプロセス終了
*   ネットワーク遅延・切断（Mock層でのシミュレーション）
*   メモリリソース枯渇状態でのAttestation要求
*   無効なポリシー設定ファイルのロード

## 8. Success Criteria
1. Test Matrixに定義された全項目をカバーするテストコードが作成され、全パスすること。
2. Functional CriteriaおよびSecurity Criteriaを100%満たすこと。
3. Adapter Layerのオーバーヘッドが許容範囲内（10ms未満）であること。

## 9. Go / No-Go Decision Criteria
以下の条件を満たした場合にのみ、Phase 8.3（Mock実装）の完了とし、次フェーズの「実TEE接続検討（要承認）」へ進むための **Go** と判定します。

*   **Go Criteria**:
    *   Success Criteriaがすべて達成されている。
    *   設計上の重大な脆弱性・欠陥が発見されていない。
    *   v2プロトコルおよび既存の回路・暗号成果物に一切の変更を必要としていないこと。
*   **No-Go Criteria**:
    *   正規化により、元のAttestation Reportの重要なセキュリティコンテキストが失われる場合。
    *   Adapterのオーバーヘッドが著しく高く、実運用に耐えない場合。
    *   既存のAegisProofのセキュリティ前提を崩す必要があると判明した場合。
