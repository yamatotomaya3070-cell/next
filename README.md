# AI動画編集トレーニングシステム（フェーズ1 MVP）

障害者就労支援事業所向けの動画編集eラーニングシステム。
利用者が模擬案件で基礎スキルを練習し、AIが教材生成・採点の下書きを行い、職員が承認・見守りを行います。

## 技術スタック

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres / Auth / Storage)
- Gemini API（教材生成・採点。未設定時はモックAIで動作）

## セットアップ

### 1. Supabase プロジェクトの準備

1. [Supabase](https://supabase.com/dashboard) で新規プロジェクトを作成
2. **SQL Editor** で以下を順に実行:
   - `supabase/migrations/00001_initial_schema.sql`（テーブル・トリガー）
   - `supabase/migrations/00002_rls_policies.sql`（RLS・Storageバケット）
3. **Authentication → Users → Add user → Create new user** でテストユーザーを2人作成
   （`staff@example.com` / `trainee@example.com`。Auto Confirm User は ON のまま）

   作成すると `profiles` 行がトリガーで自動作成されます（デフォルトは `trainee` ロール）。
   続けて **SQL Editor** でロールと表示名を設定:

   ```sql
   update profiles
   set role = 'staff', display_name = '職員 太郎'
   where id = (select id from auth.users where email = 'staff@example.com');

   update profiles
   set role = 'trainee', display_name = '利用者 花子'
   where id = (select id from auth.users where email = 'trainee@example.com');
   ```
4. （任意）**SQL Editor** で `supabase/seed.sql` を実行するとサンプル課題・割当が入ります。

### 2. 環境変数

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API から取得
- `GEMINI_API_KEY`: [Google AI Studio](https://aistudio.google.com/apikey) で取得（**未設定でもモックAIで全機能が動作します**）

### 3. 起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開き、上記ユーザーでログイン。

## 動作確認手順（利用者フロー）

1. **職員でログイン** → 「課題をAI生成」→ テーマ・難易度・スキルを入力して生成
2. 生成された課題ページで各教材を **承認** → **課題を公開する** → 利用者に **割り当てる**
3. **利用者でログイン**（別ブラウザ推奨）→ ホームに案件カードが表示される
4. 案件を開く → ①説明書 → ②手順（一つずつ表示/ぜんぶ見る切替）→「作業をはじめる」でタイマー開始
5. ③提出タブ → セルフチェック → 動画ファイルを選択 → 提出（AI採点が裏で実行される）
6. **職員に戻る** → 「添削承認」→ AI採点の下書きを確認・修正して **承認して利用者に公開**
7. **利用者に戻る** → ④結果タブに点数・良かった点・次にがんばる点が表示される
8. 職員ダッシュボードで進捗・納期超過・未回答質問を確認、利用者詳細で適性を記録

## アクセシビリティ機能（利用者「せってい」画面）

- ふりがな表示 ON/OFF（`漢字《かんじ》` 記法 → `<ruby>` 描画）
- 手順の一工程ずつ表示モード
- 文字の拡大
- 音声読み上げ（Web Speech API）
- 休憩リマインダー（間隔を選択可能）

## ディレクトリ構成

```
supabase/
  migrations/    # スキーマ提案（レビュー後にSQL Editorで適用）
  seed.sql       # 開発用サンプルデータ
src/
  proxy.ts       # 認証セッション更新・ルート保護（Next 16のproxy）
  lib/
    supabase/    # サーバー/ブラウザ クライアント
    ai/          # Gemini + モックのAIアダプタ層
    actions/     # Server Actions（提出・採点・承認・記録）
  components/    # ふりがな/手順ビューア/タイマー/提出フォーム等
  app/
    login/       # ログイン
    (trainee)/   # 利用者UI（home / tasks/[id] / settings）
    staff/       # 職員UI（ダッシュボード / reviews / tasks / users）
```

## フェーズ2（未着手・別マイルストーン）

実案件解析、依頼書根拠のAI質問応答、納品前自動チェック、文字起こし・カット候補提案、
実案件の匿名化教材化ループ、LINE通知連携。スキーマには `knowledge_base` / `qa_logs` を先行定義済み。
