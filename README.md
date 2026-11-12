# Windows Server Migration Simulator

Windows Server更改を題材に、仮想デスクトップからRDP接続し、調査・移行・切替・障害対応を体験する日本語SPAです。実サーバーやAWS/Azureには接続せず、シナリオJSONの状態だけを操作します。

## Windowsで起動

対応するNode.js（20.19以降の20系、または22.12以降）をインストールし、エクスプローラーでリポジトリを開いて **`Start Simulator.bat`** をダブルクリックします。初回起動時に依存関係をインストールし、既定のブラウザーで開きます。終了時は起動したコンソールで `Ctrl+C` を押してください。

## はじめ方

起動するとWindows風デスクトップが表示されます。案件、オンプレミス/AWS/Azure、難易度を選び、デスクトップのCMD・PowerShell・エクスプローラー・管理ツールから接続アプリを選択してRDP接続します。AWSはEC2風、Azureは仮想マシン風の画面ですが、表示・接続はすべてシミュレーションです。

| モード | プレイヤーに表示する内容 |
|---|---|
| チュートリアル | AI上司役のガイドが次の調査を案内し、実行後に確認目的を説明 |
| 初級 | 調査目的のみ。実行方法は自分で発見し、確認後に解説 |
| 中級 | 更改目標のみ。構成図やヒントなし |
| 上級 | 「切替後、ログインできません」の症状のみを提示 |

操作はブラウザーの`localStorage`へ自動保存されます。デスクトップの「続きから始める」で再開し、実行中は「最初からやり直す」で初期化できます。

## 調査・操作

旧・新サーバーを左右に並べ、接続先や同じツールを独立して切り替えて比較できます。初期画面には構成の答えを表示せず、コマンドや疑似Windows管理ツールから調査します。

```text
hostname
systeminfo
ipconfig /all
netstat -ano
route print
nslookup intra.example.local
java -version
services.msc
taskschd.msc
eventvwr.msc
certlm.msc
notepad resin.conf
type jdbc.properties
```

- **services.msc** — サービス状態、起動種類、実行ユーザーの確認と起動・停止。
- **taskschd.msc** — 実行ファイル、スケジュール、実行ユーザー、結果の確認・実行。
- **certlm.msc** — 個人・中間CA・信頼されたルートの証明書、有効期限、秘密鍵の比較・移行。
- **eventvwr.msc** — 切替後の状態に応じたイベントログから障害を調査。
- **notepad resin.conf / jdbc.properties** — 旧・新設定を比較し、編集・保存・移行。
- **JDBC移行** — APSV01でコピーを準備し、APSV02で受け取った後、`jdbc.url`を`DBSV02:1521:ORCL`に変更して保存します。コピーだけでは監査完了になりません。
- **切替前の疎通確認** — 新APで`curl http://APSV02:8080/`を実行します。Resin、resin.conf、JDBC、DBスキーマの条件を満たすと`HTTP/1.1 200 OK`になります。
- **sqlplus / as sysdba** — Oracleのバージョンとスキーマを確認。Data Pumpの疑似エクスポート・インポートを実施。
- **dnsmgmt.msc** — DNSのAレコードとTTLを調査・切替。DNS適用は名前解決先の切替であり、疎通確認ではありません。シミュレーションではTTL短縮の適用で待機完了扱いにしますが、実環境では短縮後に旧TTLの満了を待つ場合があります。切替後は`ipconfig /flushdns`を実行し、`curl http://intra.example.local:8080/`で本番名経由の稼働を確認します。

「知識ノート」には実行した調査と確認理由が記録され、「仮説メモ」には調査中の考えを残せます。作業完了後は監査レポートを表示し、実施項目・見落とし・手順順序・移行成功率・推定停止時間・障害件数・復旧時間を確認できます。レビュー文は現在ローカル規則で生成し、外部生成AIへは接続しません。

## シナリオ追加

`src/data/scenarios/*.json` の各JSONが案件です。起動時にJSONを自動検出するため、基本的にはファイル追加だけで案件選択に表示されます。Zodで構造と参照を実行時検証します。

シナリオには次を定義します。

- サーバー、VM、Database、DNS、サービス、タスク、証明書ストア、構成ファイル
- 疑似コマンド出力と障害イベント
- 難易度別の学習目標順序と実行後の解説
- チュートリアルの手順・完了イベント・解説
- 監査チェック、未実施操作の説明、修正方法、影響、重み、推奨作業順序

サーバーには`stage`（`source` / `target` / `infrastructure`）を指定します。学習目標の`commands`、監査項目の`requiredEvents`と操作イベント名は、画面のヒントやレポートと連動します。追加シナリオの各参照は`src/domain/scenario.ts`の検証スキーマを満たす必要があります。

将来の生成AI連携用に`Advisor`インターフェースを定義しています。現在は外部サービスや資格情報を使いません。

## 開発・検証

```bash
npm install
npm run dev
npm run build
```
