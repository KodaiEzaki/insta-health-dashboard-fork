# 開発コンテキスト：insta-health-dashboard

このファイルは GitHub Copilot がコンテキストを引き継ぐための作業メモです。

---

## 🔖 現在の進捗状況（2026-05-05 時点）

### 完了済み ✅
- プロジェクト作成・npm install
- Google スプレッドシート作成（「はるの朝レポ」）
  - ドロップダウン設定（6フェーズ）
  - 日付入力規則・ヘッダー固定・背景色・条件付き書式
  - Apps Script で更新日自動入力
- Google Cloud Console で Google Sheets API キー取得
- `.env` 設定（SPREADSHEET_ID・SHEETS_API_KEY・SURGE_* 全て設定済み）
- `npm run run-all` でローカル全パイプライン動作確認済み
- Surge デプロイ成功 → https://haru-asarepo-dashboard.surge.sh
- GitHub 個人アカウント作成（taku-2626、Gmail）
- GitHub リポジトリ作成（taku-2626/insta-health-dashboard、Private）
- Personal Access Token 作成済み（No expiration、repo スコープ）

### 次にやること ⏭️
- git push を完了させる（下記コマンドを実行）
- GitHub Actions シークレットを登録する
- GitHub Actions を手動実行して確認する
- `schedule` のコメントを外して毎朝6時の自動実行を有効にする

### 詰まっている箇所 🔧
- `git push` で Windows の Git 認証が会社の MS アカウントを使ってしまい失敗
- Personal Access Token を使った認証方法に切り替え済み
- **次に実行すべきコマンド**（ターミナルで直接入力、チャットには貼らないこと）：
  ```
  cd C:\Users\takumasaito\src\insta-health-dashboard
  git remote set-url origin https://taku-2626:【PATトークン】@github.com/taku-2626/insta-health-dashboard.git
  git push -u origin main
  ```

### 設定済みの値
- Surge URL: https://haru-asarepo-dashboard.surge.sh
- GitHub リポジトリ: https://github.com/taku-2626/insta-health-dashboard
- GitHub ユーザー名: taku-2626

---

## プロジェクト概要

米粉お菓子を発信するインスタグラムアカウントの運営スケジュール進捗管理ダッシュボード。
Google スプレッドシートのデータを毎朝自動取得し、健康度を判定して HTML ダッシュボードを Surge に公開する。

---

## フェーズ定義（スプレッドシートの「フェーズ」列に入力する値）

| フェーズ名 | 意味 |
|---|---|
| リサーチ中 | レシピアイデアをリサーチしている |
| レシピ作成中 | レシピを組み立て中 |
| 試作中 | 実際に試作している |
| 撮影中 | 撮影に入った |
| 動画編集中 | 動画編集中 |
| 投稿完了 | インスタに投稿した |

---

## 健康度チェック仕様

### チェック1: 上流ストック
- 対象: リサーチ中 + レシピ作成中 + 試作中 の合計
- 🟢 安全: 6本以上
- 🟡 注意: 3〜5本
- 🔴 危険: 2本以下

### チェック2: 中流進行
- 対象: レシピ作成中 + 試作中 の合計
- 🟢 安全: 3本以上
- 🟡 注意: 1〜2本
- 🔴 危険: 0本

### チェック3: 下流進行
- 対象: 撮影中 + 動画編集中 の合計
- 🟢 安全: 1本以上
- 🔴 危険: 0本（注意なし）

### チェック4: 投稿後フォロー
- 最後に「投稿完了」になったレシピの更新日からの経過日数を計測
- ただし下流（撮影中 or 動画編集中）に 1 本以上あることが条件
- 🟢 安全: 3日以内かつ下流 ≥ 1
- 🟡 注意: 4〜5日 or 3日以内でも下流 = 0
- 🔴 危険: 5日超かつ下流 = 0
- 未投稿の場合: このチェックをスキップ（null）

---

## スプレッドシート構成

| 列 | 内容 |
|---|---|
| A | レシピ名 |
| B | フェーズ（上記6種のいずれか） |
| C | 更新日（YYYY-MM-DD形式） |
| D | メモ |

シート名: `シート1`  
ヘッダー行: 1行目  
データ開始: 2行目（A2:D）

---

## 環境変数

| 変数名 | 内容 |
|---|---|
| `INSTA_SHEETS_SPREADSHEET_ID` | Google スプレッドシートの ID（URL の /d/〇〇〇/edit の部分） |
| `INSTA_SHEETS_API_KEY` | Google Sheets API キー（スプレッドシートを「リンクを知っている人が閲覧可能」に設定） |
| `INSTA_GEMINI_API_KEY` | Gemini API キー（Google AI Studio で取得） |
| `INSTA_SURGE_LOGIN` | Surge のメールアドレス |
| `INSTA_SURGE_TOKEN` | Surge トークン（`npx surge token` で取得） |
| `INSTA_SURGE_DOMAIN` | Surge ドメイン（例: my-insta-dashboard.surge.sh） |

---

## ファイル構成

```
insta-health-dashboard/
  _dev-notes/          ← このフォルダ（開発コンテキスト）
    context.md
  config/
    settings.js        ← フェーズ名・API URL などの定数
    health-thresholds.yaml  ← 健康度閾値（コード不要で変更可）
    ai-prompts/
      unified.md       ← Gemini へのプロンプトテンプレート
    dashboard-styles.css  ← ダッシュボードの見た目
  scripts/
    fetch-data.js           ← Google Sheets からデータ取得
    calculate-health.js     ← 健康度計算
    generate-ai-suggestions.js  ← Gemini でコメント生成
    ai-suggestion-helpers.js    ← フォールバック提案ロジック
    generate-dashboard.js   ← HTML 生成
    deploy-to-surge.js      ← Surge デプロイ
  .github/workflows/
    run-dashboard.yml       ← GitHub Actions（毎朝6時 JST）
  data/                ← 実行時に自動生成（.gitignore 済み）
  output/              ← 実行時に自動生成（.gitignore 済み）
  dist/                ← Surge デプロイ用（.gitignore 済み）
  .env                 ← 実際の API キー（.gitignore 済み）
  .env.example         ← 設定のテンプレート
  package.json
```

---

## パイプライン実行順

```
npm run run-all
  ① fetch-data          → data/sheets-data.json
  ② calculate-health    → data/health-data.json
  ③ ai-suggestions      → data/ai-suggestions.json
  ④ generate-dashboard  → output/dashboard.html
  ⑤ deploy              → Surge（毎回同じURL を上書き）
```

---

## 将来の拡張予定

- LINE公式アカウントで毎朝ダッシュボードの画像を通知（Phase 2）
- 案件・アフィリエイト管理をスプレッドシートの別シートで管理（Phase 3）
  - スプレッドシートに「カテゴリ」列を追加するだけで対応できる設計を意識すること

---

## 参照プロジェクト

`C:\Users\takumasaito\src\progress-dashboard` が構造の参考元。
Linear → Google Sheets に置き換え、Slack → Surge のみ に簡略化。
