# セットアップガイド

このツールを動かすまでの全手順です。
**ステップ順に進めてください。** 1日で全部やらなくて大丈夫です。

---

## 進捗チェックリスト

- [ ] Step 1: Google スプレッドシートを準備する
- [ ] Step 2: Google Sheets API キーを取得する
- [ ] Step 3: .env ファイルを作成する
- [ ] Step 4: ローカルで動作確認する（フェーズ①〜④）
- [ ] Step 5: Surge アカウントを準備する
- [ ] Step 6: ローカルで全パイプラインを動かす
- [ ] Step 7: GitHub にリポジトリを作成してプッシュする
- [ ] Step 8: GitHub Actions シークレットを登録する
- [ ] Step 9: GitHub Actions を手動実行して確認する
- [ ] Step 10: 毎朝6時の自動実行を有効にする

---

## Step 1: Google スプレッドシートを準備する

### 1-1. スプレッドシートを作成する

1. [Google スプレッドシート](https://sheets.google.com/) を開く
2. 「空白のスプレッドシート」を作成する
3. シート名を `シート1` のまま（変えないこと）

### 1-2. ヘッダー行を入力する

1行目に以下を入力する：

| A列 | B列 | C列 | D列 |
|---|---|---|---|
| レシピ名 | フェーズ | 更新日 | メモ |

### 1-3. テスト用データを入力する

2行目以降にテストデータを入力する。フェーズ列には以下の6種のいずれかを正確に入力すること：

```
リサーチ中
レシピ作成中
試作中
撮影中
動画編集中
投稿完了
```

例：

| A | B | C | D |
|---|---|---|---|
| 米粉マフィン | 試作中 | 2026-05-01 | チョコ入り検討 |
| 米粉クレープ | リサーチ中 | 2026-05-02 | |
| 米粉パンケーキ | レシピ作成中 | 2026-05-03 | |

### 1-4. 公開設定を変更する

**APIキーでアクセスするために必須の設定です。**

1. 右上の「共有」ボタンをクリック
2. 「リンクを知っている全員」を選択
3. 権限を「閲覧者」に設定
4. 「完了」をクリック

### 1-5. スプレッドシートIDをメモする

URLの以下の部分がスプレッドシートIDです：

```
https://docs.google.com/spreadsheets/d/【ここがID】/edit
```

例：`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

---

## Step 2: Google Sheets API キーを取得する

### 2-1. Google Cloud Console にアクセス

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス（Google アカウントでログイン）
2. 上部の「プロジェクトを選択」→「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例：`insta-dashboard`）して「作成」

### 2-2. Google Sheets API を有効にする

1. 左メニュー「APIとサービス」→「ライブラリ」
2. 検索ボックスに「Google Sheets API」と入力
3. 「Google Sheets API」をクリック→「有効にする」

### 2-3. API キーを作成する

1. 左メニュー「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「APIキー」
3. 作成されたキーをコピーする（`AIza` で始まる文字列）

> **制限の設定（推奨）**：「キーを制限」→「APIの制限」→「Google Sheets API」のみを選択すると安全です。

---

## Step 3: .env ファイルを作成する

### 3-1. .env.example をコピーする

Cursor/VSCode のターミナルで以下を実行：

```bash
cd C:\Users\takumasaito\src\insta-health-dashboard
cp .env.example .env
```

### 3-2. .env を編集する

`.env` ファイルを開いて以下を設定する（Gemini と Surge はまだ空でOK）：

```
INSTA_SHEETS_SPREADSHEET_ID=（Step 1-5 でメモしたID）
INSTA_SHEETS_API_KEY=（Step 2-3 で取得したキー）

INSTA_GEMINI_API_KEY=（Step 4 で設定）

INSTA_SURGE_LOGIN=（Step 5 で設定）
INSTA_SURGE_TOKEN=（Step 5 で設定）
INSTA_SURGE_DOMAIN=（Step 5 で設定）
```

> ⚠️ `.env` は `.gitignore` で除外済みです。Git にコミットされません。
> ⚠️ API キーをチャットや他人に見せないでください。

---

## Step 4: ローカルで動作確認する

ターミナルで `C:\Users\takumasaito\src\insta-health-dashboard` に移動した状態で実行する。

### 4-1. データ取得を確認する

```bash
npm run fetch-data
```

✅ 成功：`data/sheets-data.json` にレシピ一覧が保存される  
❌ エラーが出た場合：スプレッドシートの公開設定（Step 1-4）を確認

### 4-2. 健康度計算を確認する

```bash
npm run calculate-health
```

✅ 成功：`🟢 安全` `🟡 注意` `🔴 危険` のいずれかが表示される

### 4-3. AI提案生成を確認する（Gemini APIキー未設定でもOK）

```bash
npm run ai-suggestions
```

✅ 成功：Gemini キーが未設定でも「フォールバック提案」が生成される

### 4-4. HTML生成を確認する

```bash
npm run generate-dashboard
```

✅ 成功：`output/dashboard.html` が生成される  
`output/dashboard.html` をブラウザで開いてダッシュボードを確認する

---

## Step 5: Surge アカウントを準備する

### 5-1. Surge にログイン（初回はアカウント自動作成）

```bash
npx surge login
```

メールアドレスとパスワードを入力する。  
> パスワード入力時は画面に何も表示されません。そのまま入力してEnterを押してください。

### 5-2. トークンを取得する

```bash
npx surge token
```

表示されたトークンをコピーする。

### 5-3. .env に追記する

```
INSTA_SURGE_LOGIN=あなたのメールアドレス
INSTA_SURGE_TOKEN=（コピーしたトークン）
INSTA_SURGE_DOMAIN=（好きな名前）-dashboard.surge.sh
```

ドメイン名は自由に決められます。例：`komeko-insta-dashboard.surge.sh`  
すでに他の人が使っている名前は使えないので、ユニークな名前を設定してください。

---

## Step 6: ローカルで全パイプラインを動かす

```bash
npm run run-all
```

✅ 成功：Surge のダッシュボードURLが表示され、ブラウザで確認できる

---

## Step 7: GitHub にリポジトリを作成してプッシュする

### 7-1. GitHub アカウントがない場合は作成する

[GitHub](https://github.com/) でアカウントを作成する。

### 7-2. 新しいリポジトリを作成する

1. GitHub の右上「+」→「New repository」
2. Repository name: `insta-health-dashboard`
3. **Private** を選択（APIキー設定ファイルがあるため）
4. 「Create repository」をクリック

### 7-3. ローカルリポジトリを初期化してプッシュする

ターミナルで以下を実行（`あなたのGitHubユーザー名` は自分のものに変更）：

```bash
cd C:\Users\takumasaito\src\insta-health-dashboard
git init
git add .
git commit -m "初回コミット"
git remote add origin https://github.com/あなたのGitHubユーザー名/insta-health-dashboard.git
git branch -M main
git push -u origin main
```

> `package-lock.json` がコミットに含まれていることを確認してください（GitHub Actions が使います）。

---

## Step 8: GitHub Actions シークレットを登録する

GitHub Actions はコード内に直接APIキーを書かず、「シークレット」という安全な保管場所を使います。

1. GitHub のリポジトリページを開く
2. 上部タブ「Settings」→ 左メニュー「Secrets and variables」→「Actions」
3. 「New repository secret」で以下を1つずつ登録する

| シークレット名 | 値 |
|---|---|
| `INSTA_SHEETS_SPREADSHEET_ID` | スプレッドシートID |
| `INSTA_SHEETS_API_KEY` | Google Sheets API キー |
| `INSTA_GEMINI_API_KEY` | Gemini API キー（未取得なら空欄でも可） |
| `INSTA_SURGE_LOGIN` | Surge メールアドレス |
| `INSTA_SURGE_TOKEN` | Surge トークン |
| `INSTA_SURGE_DOMAIN` | Surge ドメイン（例: komeko-insta-dashboard.surge.sh） |

---

## Step 9: GitHub Actions を手動実行して確認する

1. GitHub リポジトリの上部タブ「Actions」を開く
2. 左メニューに「ダッシュボード更新」が表示される
3. 「Run workflow」→「Run workflow」をクリック
4. 実行が完了（緑のチェックマーク）したら成功

❌ 失敗した場合：実行ログの赤いステップをクリックしてエラー内容を確認する

---

## Step 10: 毎朝6時の自動実行を有効にする

`.github/workflows/run-dashboard.yml` を開いて、`schedule` のコメントを外す：

**変更前：**
```yaml
  # schedule:
  #   - cron: '0 21 * * 0-4'
```

**変更後：**
```yaml
  schedule:
    - cron: '0 21 * * 0-4'
```

変更後にコミット＆プッシュすると、翌日から毎朝6時（JST）に自動実行されます。

```bash
git add .github/workflows/run-dashboard.yml
git commit -m "毎朝6時の自動実行を有効化"
git push
```

---

## つまずいたときは

| 症状 | 確認場所 |
|---|---|
| `fetch-data` でデータが0件 | スプレッドシートの公開設定・フェーズ名のスペルを確認 |
| `fetch-data` で API エラー | スプレッドシートIDとAPIキーを `.env` で確認 |
| Surge デプロイ失敗 | `npx surge login` でログイン状態を確認 |
| GitHub Actions が失敗 | Actions タブのログでエラーステップを確認、シークレットの入力ミスが多い |
| Gemini エラー | フォールバック機能で自動的に提案が生成されるので無視してOK |

困ったときは AI（GitHub Copilot）にエラー文を貼って質問してください。
