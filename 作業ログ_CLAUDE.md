# 作業ログ（Claude）

このファイルは、Claude が本リポジトリで行った作業と、直前に Codex が加えた未コミット変更を記録する「作業ノート」です。
毎回の作業ごとに末尾の「## 作業記録」へ追記します。

> 注意：本リポジトリの `CLAUDE.md` は `@AGENTS.md` を読み込む設定ファイルのため、上書きしていません。
> 記録はこのファイル（`作業ログ_CLAUDE.md`）に集約します。

---

## 0. 背景

- 対象仕様書: `docs/Astra6向け_動画編集学習システム改善指示書.md`（作成 2026-09-11）
- 現段階は**方向性打ち合わせ前**。仕様書は確定仕様ではなく、会議で合意した項目だけを実装対象にする方針。
- AGENTS.md 制約: Next.js 16.2.10（独自版）。Next.js 関連コードを変更する前に `node_modules/next/dist/docs/` の該当ガイドを読むこと。

---

## 1. Git ベースライン

- 直近コミット: `b5690ff feat: 学習ルールの編集機能を追加し既存ルールの実効性を強化`（2026-08-31）
- 以降（2026-09-11〜09-13）の変更は**すべて未コミット**（working tree のみ）。

---

## 2. Codex による未コミット変更（2026-09-13 時点の棚卸し）

仕様書のギャップ #3〜#9（指示書・素材・完成見本の不一致）を中心に、**Phase 1 の一部**を実装。
利用者本番フローは壊さない方針で、アプリ側の変更は開発環境限定（`NODE_ENV === "development"`）に留めている。

### 2-1. 変更されたファイル（modified）

| ファイル | 変更概要 | 対応ギャップ |
|---|---|---|
| `poc/scene/build_materials.mjs` | 「タイミング表.csv」→「作業指示一覧.csv」に変更。絶対秒（fmt）を廃止し順番中心の列構成へ。アニメ済みMP4素材（`素材/映像`）の書き出しに対応。SECTION_JA追加。VOX/VISUAL_ASSET_DIR を環境変数で上書き可能に。 | #3 #4 #9 |
| `poc/scene/build_manual.mjs` | 手順書から絶対タイムコードを削除。字幕/強調テロップ/図解の**安全領域・具体スタイル数値**を明記。アニメMP4があればV1配置、なければ静止画フォールバックの案内。 | #5 #6 #7 |
| `poc/scene/build_app_task.mjs` | アプリ用 app_task.json 生成を「作業指示一覧」ベースへ。字幕本文=共通色/話者名・左帯=話者色の指示に統一。BGMは固定dBをやめ見本基準に。 | #5 #8 |
| `poc/scene/render_project.mjs` | オーバーレイ無しの「見本と同じ動きの映像」フレームを別途描画し、シーン別 `visual_assets/visual_<tag>.mp4` を生成。WORK/VOX を環境変数で上書き可能に。 | #9 |
| `poc/scene/builders.mjs` | `convFrame(scene, sched, options)` に options を追加し overlay 有無を制御。 | #9 |
| `poc/infographic/conversation.mjs` | `buildConversationSVG(scene, t, { includeOverlays })` を追加。テロップ/字幕/セクションを描き分け可能に（見本映像素材の生成用）。 | #9 |
| `src/app/(trainee)/tasks/[id]/page.tsx` | 開発環境限定で「改訂手順（ローカルテスト版）」を表示。本番手順データは未変更（注記バナー付き）。 | #5〜#9 の検証用 |
| `src/proxy.ts` | 開発環境限定で `/local-preview` を公開パスに追加。 | プレビュー導線 |
| `package.json` / `package-lock.json` | 依存追加（要確認）。 | — |

### 2-2. 追加されたファイル（untracked）

- `src/lib/local-fixtures/revisedNewNisaManual.ts` — 改訂版・新NISA手順ステップ（開発限定・特定 task_id にのみ適用）。
- `src/app/local-preview/manual/page.tsx` — 手順プレビュー用の開発ページ。
- `docs/video-editing-manual-revised.md` — 改訂版・動画編集手順書（人間可読版）。
- `docs/打ち合わせ準備_動画編集システム改善_2026-09-11.md`、`docs/開発者向け_対応可否・完成条件・概算工数.md` — 会議・見積り資料。
- `scripts/*.ts` / `scripts/fetch-scene-project.mjs` — 生成・検査・テスト投入スクリプト群。
- `scripts/output/**`、`poc/scene/test-fixtures/`、`テスト用_動画編集パッケージ/`、`テスト用_動画編集パッケージ.zip` — 生成物（成果物サンプル）。
- `supabase/.temp/` — 一時ファイル。

### 2-3. Codex の到達点まとめ

- **やったこと**: 利用者向け指示から絶対秒を排除し「順番＋必要な間だけフレーム」へ。字幕/テロップ/図解/BGM のスタイルを具体化。見本と同じ動きの MP4 素材を生成する配線。改訂手順をローカルプレビューで確認できる状態。
- **本番は未変更**: アプリの表示切替はすべて開発環境限定。DBやマイグレーションは未着手。

---

## 3. 未着手（仕様書 Phase 1 の残り＝会議で合意後に着手）

- #11 提出後の状態タイムライン表示（現在の状態/担当/次にすること/更新日時）
- #12 AI採点失敗でも職員レビュー待ちレコードを必ず作成
- #14 公開前整合性チェック（見本・指示・素材の一致検証、重大不一致で公開停止）
- #4/#5 アプリ側での `EditorInstructionRow` / `InternalTimelineRow` / `SubtitleStyle` 共通スキーマ化（現状は poc/*.mjs レベルのみ）
- Phase 2: DaVinci バージョン別教材管理（`tutorial_modules` / `tutorial_progress`）、学習画面、進捗＆職員承認
- Phase 3: `poc/scene/*` と `scripts/video/*` の共通編集指示スキーマへの統合

---

## 作業記録

### 2026-09-13 18:22 — 初回：現状把握と本ログ作成（Claude）
- Codex の未コミット変更を棚卸しし、本ファイルに記録（上記 §2）。
- ビルド健全性の軽確認: `src/lib/types.ts` に `ManualStep` が存在し、trainee ページの新規 import は型解決可能。
- コード変更はまだ行っていない（記録のみ）。
- 次の一手は方向性の確認待ち（会議前のため大規模実装は保留）。

### 2026-09-13 18:40 — 成果物の再生成・検証、テスト用パッケージ整合化、ローカルアプリ確認（Claude）
方針: ユーザーが「初心者として手順書どおりにDaVinciで実編集し、アプリ上で改訂反映を確認」する。本番デプロイはしない。

**A. 成果物パッケージの再生成（#9 動くMP4素材の反映）**
- 検証で判明: `テスト用_動画編集パッケージ` は #9 未反映（静止画のみ）だった。加えて音声39ファイル（12シーンnewnisa混在）・完成見本が8/15の12シーン版で、10シーンの改訂CSVと不整合だった。
- 整合する3点セットを特定（相互一致を実測で確認）:
  - PROJECT = `poc/scene/out/e2e_revised_project.json`（10シーン）
  - 映像素材 = `poc/scene/out/e2e_revised_work/visual_assets/visual_001〜010.mp4`（Codexが本日レンダ済み）
  - vox = `poc/scene/out/vox`（s{tag}_l{li}.wav・行数が e2e_revised と一致）
  - 完成見本 = `poc/scene/out/e2e_revised_completed.mp4`
  - 各シーンMP4尺は音声合計より一様に約1.2〜1.7秒長いのみ→順番ベース設計では許容（V1を音声長に合わせて伸ばす運用）。
- 再レンダ不要・APIキー不要で以下を実行し `poc/scene/out/verify_pkg` に生成:
  - `node poc/scene/build_materials.mjs poc/scene/out/e2e_revised_project.json poc/scene/out/verify_pkg`（env: SCENE_VISUAL_ASSET_DIR / SCENE_VOX_DIR / SAMPLE_VIDEO）
  - `node poc/scene/build_manual.mjs poc/scene/out/verify_pkg`
  - `node poc/scene/build_app_task.mjs poc/scene/out/verify_pkg`
- 検証: CSVの図解・映像素材名は全10シーンがMP4参照／CSV・手順書とも小数秒タイムコードなし／手順書は「アニメーション済みMP4をV1へ」明記。
- `テスト用_動画編集パッケージ` へ反映:
  - `02_改訂版/作業指示一覧.csv` を差し替え
  - `02_改訂版/手順書_シーン別作業カード.md` を新規追加（生成版・実ファイル名入り）
  - `03_動画素材/素材` を整合版に置換（映像10本追加・音声29に是正・図解PNG0＝全MP4）
  - `04_完成見本/完成見本.mp4` を10シーン版（e2e_revised_completed.mp4, 10,175,869B）に差し替え
  - `02_改訂版/手順書_改訂版.md`（人間可読の改訂手順書＝docs/video-editing-manual-revised.md 由来）は維持。

**B. ローカルアプリでの改訂反映確認**
- devサーバーは既に3000番で稼働中（別プロセス）。新規起動は不要。
- 確認URL: `http://localhost:3000/local-preview/manual` → HTTP 200、改訂手順（StepViewer, 開発限定・DB/認証不要）を表示。
- 実アプリ導線: `/tasks/28a6c3ba-71c4-4768-bc15-554ee1de5149`（trainee）でも開発環境限定で改訂手順を表示（ログイン＋当該taskの存在が必要）。

**未コミット**: 上記はすべて生成物・テスト用フォルダの更新で、アプリ/DBのコード変更は無し。

### 2026-09-13 以降 — 実テスト由来の改善アイデア（ユーザー廣田氏の初心者テスト中に判明）

利用者(ユーザー)が実際にDaVinciで手順書どおり編集する中で見つかった、手順・教材の不備。`manual_guidelines`(00019) / Astra6 Phase2 の対象。

1. **「Import Media」でつまずく（手順の不備）**
   - 現状: 手順書が「メディアプールを右クリック→Import Media→素材フォルダの中身を読み込む」と記載。
   - 問題: 素材フォルダは中に小分け(映像/音声/立ち絵/背景/BGM)があり、Import Media はサブフォルダを一括取り込みできない。初心者が字義通りだと詰まる。
   - 修正案: 手順書を「**Import Media Folder...（メディアフォルダーを読み込み）→ 素材フォルダを指定**」またはフォルダのドラッグ&ドロップに変更。`build_manual.mjs`／改訂手順書の該当箇所。

2. **毎回同じ設定は「文章より動画＋設定済みスタート」（Astra6 Phase2 / ギャップ#1・#2の裏付け）**
   - 指摘: 案件が変わっても毎回同じ操作（1280×720/24fps設定・素材読込・トラック割当・書き出し設定）は、文章で毎回説明されても分かりにくい。「1回操作動画を見れば分かる」形＋その設定済み状態からスタートできる方がよい。
   - 改善の方向: (a) 共通操作の**短い操作動画1本**（Phase2 tutorial_modules の video + fallback_steps）、(b) **設定済みDaVinciテンプレート(.drp)を素材と同梱**し、利用者は「素材を並べる本題」から開始できるようにする。案件ごとに変わる指示は従来どおり作業指示一覧.csv。
   - 未決定（人手が必要）: 対象DaVinciバージョンの確定と操作動画の実収録（仕様書 §12 のとおりコーディングだけでは完了しない）。

### 2026-09-14 19:05 — DaVinci実機操作で画像つき手順書を作る試み（Claude）
- 目的: ユーザーPCのDaVinci Resolveを実際に操作し、各操作の画面を撮って日本語・画像つきのやさしい手順書＋テンプレートを作る。
- 環境: Resolve 21.1.0.17 **無料版**、UIは日本語に変更済(ユーザー実施)。モニター2枚(メイン1280x800にResolve、サブ1280x720にVS Code)。
- 判明: 無料版は外部スクリプト接続が不可(scriptappがNone)。内部コンソール経由の常駐ブリッジは自動モードの安全判定で不可、GUIクリック自動操作も途中から不可判定。→ **自動操作は停止**。ブリッジ用ファイル(kizuna_bridge.py / kb.py)は削除済。
- 作成済(未検証・未同梱): 字幕3話者＋強調テロップのFusionタイトルテンプレ生成スクリプト(scratchpad)。見本の字幕/テロップ見た目を完成見本フレームで確認済。
- 次: ユーザーが権限モードを通常(毎回承認)に切替えて操作を再開するか、ユーザーがクリックし私が撮影・注釈する方式かを選択待ち。

### 2026-09-14 21:40 — DaVinci実機操作 → 画像つき手順書＋テンプレート完成（Claude）
ユーザー要望:「文字の手順書は分からない。自分のPCのDaVinciを実際に動かして、どこを押すか画像つきで、柔らかく。同じ設定はテンプレ化」。

**実施（承認モードでGUI操作。無料版は外部スクリプト不可のため、クリック操作＋Resolve内コンソール(Lua dofile)を併用）**
- 環境: Resolve 21.1.0.17 無料版/日本語UI。メイン画面は物理1920x1200・150%拡大（座標は×1.5で換算）。
- 新規プロジェクト「新NISA_編集見本」で手順どおり実作業: 1280×720/24fps設定→素材をエクスプローラーからD&D→リスト表示＋検索「_0」→全選択→編集＞タイムラインの末尾に追加（音声29本が順番どおり）→mp4をV1配置＆トリム（10本はLuaで配置）→BGM A2＋インスペクタ-20dB→字幕テンプレでS1の字幕4本＋強調テロップ→デリバーでMP4/H.264書き出し（`C:\Users\yamat\Videos\新NISA_完成動画.mp4`、1280x720/24fps/200.5秒、テスト用・S1のみ字幕）。
- 途中でResolveが1回クラッシュ（Luaでテンプレ用プロジェクト作成→保存直後）。作業プロジェクトは無事。ExportProjectのスクリプト実行は避けること。
- 誤って作った文字化け名プロジェクトとコピーのテスト用プロジェクトは削除済。

**成果物（テスト用_動画編集パッケージ）**
- `02_改訂版/画像つき手順書/手順書を開く.html`＋`img/`28枚（赤丸番号つき実画面）。最初の1回（日本語化/字幕の型/ひな形読込/書き出しプリセット）＋動画ごと9手順＋チェック＋困ったとき＋職員向けメモ。
- 公開版Artifact: https://claude.ai/code/artifact/150a8215-d1e1-483d-94c7-ef596a3bac56 （元HTMLはscratchpad）
- `05_テンプレート/`: `絆_動画編集テンプレート.drp`（1280x720/24fps、V1映像/V2立ち絵/V3字幕/V4強調テロップ/A1セリフ/A2BGM）、`絆_YouTube_720p.xml`（MP4/H.264/1280x720）、`字幕とテロップ/`4種(.setting, Fusionタイトル: 話者3色字幕＋強調テロップ)、`字幕テンプレートを入れる.bat`（%APPDATA%…Templates\Edit\Titles\絆テンプレート へコピー、実行確認済）。
- `はじめに.md` を画像つき手順書と05_テンプレート起点に更新。**zip(テスト用_動画編集パッケージ.zip)は未更新**。
- 生成スクリプト(scratchpad): drafts/make_titles.py（.setting生成）, drafts/annotate.cjs（赤印画像）, steps/place_base.lua（CSV順にV1/A1/A2自動配置）。

**見本と支給素材のずれ（実作業で確認。手順書の職員向けメモに記載）**
1. 見本には opening.mp4(3.2s)「マネーの学校」と ending.mp4(7.4s) があるが素材に無い。
2. 見本はセリフ間に間(HEAD0.4/GAP0.28/TAIL0.5)があるが、作業指示一覧の「空ける間」は全空欄（間なしだと約14秒短い）。
3. 見本は左上に場面名(renderSection)が出るが指示・素材に無い。
4. 見本BGM=assets/video/bgm_classroom_body.wav、支給BGM.wav=旧bgm_loop.wav（別の曲）。
5. 強調テロップの重ね表示は会話シーン(S1,S2,S7,S10)のみ・onScreenText[0]のみ。図解シーンは映像に文字が焼き込み済みなのに、作業指示一覧は全シーンにテロップ文言を記載→二重になる。手順書は見本に合わせ「会話の場面だけ・/の最初の言葉だけ」と指示。
- 補足: 字幕テンプレは2行用の固定幅（見本は文字数で幅可変）。書き出し音量は見本より約3LU大きい(-13.6 vs -16.6 LUFS)。

### 2026-09-14 23:30 — フィードバック反映①：土台（見本と素材のずれ）修正＋並べる作業の自動化（Claude）
ユーザー方針(09-14): 教科書は汎用に（操作録画の動画が理想・アプリ手順からリンク）／土台修正が大前提・手順どおりで完成するか精査／単純作業は自動化（どのPCでも・職員がすぐ設定できるか検討）／B型なので全自動にはしない／工数削減のため見本の質は下げてよい。

**コード変更（未コミット）**
- `poc/infographic/conversation.mjs`: buildConversationSVG に `includeSection`（左上の場面名）オプション追加。
- `poc/scene/render_project.mjs`: env `SCENE_SECTION_LABEL=0` で場面名を描かない（会話・図解とも）。
- `poc/scene/build_materials.mjs`: BGMを見本と同じ `assets/video/bgm_classroom_body.wav`(env BGM_FILE)に／`素材/映像/オープニング.mp4`・`エンディング.mp4` を同梱／CSV強調テロップ列は会話シーンの1語目だけ（図解は補足に「不要（映像に文字あり）」）／manifest に overlayTelop。
- `poc/scene/build_manual.mjs`・`build_app_task.mjs`: テロップ表記を overlayTelop に。
- 見本再レンダ: `SCENE_SECTION_LABEL=0 SCENE_WORK_DIR=poc/scene/out/v3_work node poc/scene/render_project.mjs poc/scene/out/e2e_revised_project.json poc/scene/out/v3_completed.mp4`（vox キャッシュ使用・APIキー不要）。
- 素材パッケージ再生成: `poc/scene/out/v3_pkg`（テスト用_動画編集パッケージの 02/03 に反映済）。

**自動化（05_テンプレート）**
- `スクリプト/絆_素材を並べる.lua`: ［ワークスペース］→［スクリプト］で実行。ファイル名だけで判断（CSV不要）→ 1280x720/24fps設定、タイムライン「本編」＋トラック名、オープニング→S01映像＋セリフ(頭0.4s/間0.28s/尻0.5s＝見本と同じ)…→エンディング、BGMを本編長ぶんA2、書き出しプリセット読込、完了ダイアログ。二重実行ガードあり。
- `セットアップ（職員用）.bat`: 字幕テロップ型→Templates\Edit\Titles\絆テンプレート、スクリプト＋プリセットxml→Scripts\Utility。実行確認済。旧 bat/.drp は削除。
- 互換性: APIチェンジログで AppendToTimeline の音声トラック指定バグが 20.2.2 で修正 → **全PCを DaVinci Resolve 21 に揃える前提**。Windows用bat（Macは手動コピー）。
- **未検証**: メニューからの実行（日本語ファイル名の読み込み可否含む）とGUIでの一連の精査。ユーザーがPC使用中のため中断（fuscriptのloadfileは日本語パスで失敗したので要確認、ダメならASCII名に）。
- GUI操作ヘルパー: 自分のクリックでアイドル判定が崩れるため「前回ステップ後にマウスが動いていたら停止」方式に変更。
- 23:55 見本再レンダ完了 `poc/scene/out/v3_completed.mp4`（226.2s、opening/ending あり、場面名なし）→ テスト用パッケージ 04_完成見本 に差し替え済。
- 並べるスクリプトのタイミングを実素材の長さでオフライン試算 → 226.21s（見本 226.23s、差約1フレーム）。各シーン映像は計算長より1〜3フレーム長いので映像長を採用。

### 2026-09-15 — フィードバック反映②：アプリ内「動画編集の教科書」＋手順リンク＋ナレーション準備（Claude）
ユーザー決定: 操作動画は声で読み上げ／教科書は利用者ページと職員ページの両方に置く。

**アプリ（未コミット・未デプロイ・DB変更なし）**
- `src/lib/guide/chapters.ts`: 教科書データ（全10章：画面の見方／プロジェクト／素材を入れる／素材を並べる(自動・手動)／字幕／強調テロップ／BGMと音量／書き出し／こまったとき／パソコンの準備(職員のみ)）。`guideHref`・`guideLabel`。画像は `public/guide/img/`（30枚、g_screen_map・g_new_project を追加生成）。
- `src/components/guide/GuideIndex.tsx`・`GuideChapterView.tsx`（章内目次・番号凡例・注意枠・前後章・video 枠は video がある章だけ表示）。
- ルート: `/guide`・`/guide/[slug]`（利用者、職員向け章は404）、`/staff/guide`・`/staff/guide/[slug]`。サイドバーに「動画編集の教科書」(新アイコン IconBook)。開発専用プレビュー `/local-preview/guide`（ログイン不要）。
- 手順との連携: `ManualStep.guide`（"subtitles#place"形式）。StepViewer に「📘 やり方を教科書で見る」リンク（別タブ）。職員の手順エディタに教科書リンクの選択欄。`updateManualSteps` が image_url/guide を捨てていた不具合も修正（保持）。
- `poc/scene/build_app_task.mjs`: 手順を新フロー11ステップ（短文＋guide付き）に。依頼書の編集ルールも更新。`src/lib/local-fixtures/revisedNewNisaManual.ts` を同内容に更新。`build_materials.mjs` 会話シーンの補足に「2つ目のセリフの頭から場面の終わりまで表示」。
- tsc / eslint 通過。dev でヘッドレスChromeスクショ確認（目次・字幕の章）。

**ナレーション（操作動画用）**
- `poc/guide/narration.json`（7章39セグメント、各セグメントに収録時の操作メモ）、`poc/guide/tts_narration.mjs`（Gemini TTS・Kore）。出力 `poc/guide/out/narration/<章>/<id>.wav`＋`durations.json`（合計約5分）。
- 注意: 指示文と読み上げ文を分けないと 400「Model tried to generate text」になる→プロンプトを「次の文章を読み上げて：「…」」形式に修正。「絆」は誤読防止で「きずな」表記。
- 試聴用: `poc/guide/out/ナレーション試聴_素材を並べる.mp3`。

**残り（PCの画面操作が必要）**: メニューから「絆_素材を並べる」を実行して動作確認→新フローで最後まで作って新しい見本と比較→「素材を並べる」章の画面写真→操作の録画＋ナレーション合成→各章に video を設定。

### 2026-09-16 00:30 — 実機検証①：「絆_素材を並べる」メニュー実行（Claude）
- セットアップbat後、［ワークスペース］→［スクリプト］に「絆_素材を並べる」が出ることを確認（日本語ファイル名でもメニュー実行OK。console の dofile だけは日本語パス不可）。
- 新規プロジェクト→素材フォルダD&D→メニュー実行で、V1=オープニング+S01〜S10+エンディング(12)、A1=31(オープニング音+セリフ29+エンディング音)、A2=BGM17本(本編区間のみ)、全長5428f=226.17s（見本226.23s、差約1〜2f）。
- 無料版は UIManager=nil で完了ダイアログが出ない→タイムライン先頭マーカー(緑/失敗は赤)に変更。再生位置が先頭だとビューアにメッセージが自動表示されることを確認。プリセット取込パスは debug=nil のため `fu:MapPath("Scripts:Utility/…")` に変更。
- 教科書「素材を並べる」章に実画面2枚(arrange_menu/arrange_done)追加。ナレーション arrange/04 を差し替え。手順tipも更新。
- スクリプト検証で分かったAPI制約: InsertFusionTitleIntoTimeline はV1へリップル挿入(ロック時nil)、クリップのトリムAPIなし→字幕配置は画面操作が必要。文字は comp:FindTool("Body"):SetInput("StyledText") で設定可。
- 字幕検証: S1〜S2の字幕7本・テロップ2本を画面ドラッグで配置、文字はLua検証スクリプトで流し込み（位置は1本だけ8f遅れ、1本は7f長い）。ユーザーのPC使用で中断。S3〜S10字幕・BGM-20・書き出し・見本比較は未了。検証用 steps/finish_verify.lua（BGM AudioVolume=-20→プリセットで書き出し）準備済み。

### 2026-09-17〜18 — 実機検証②（通し）＋見本のずれ修正＋教科書の操作動画7本（Claude）
**通し検証（プロジェクト「新NISA_自動配置テスト」）**
- 字幕29本・強調テロップ4本を配置し、全部フレーム単位で音声と一致（check.js で 29/29・問題0）。文字流し込み→BGM -20dB→プリセットで書き出しまで完走。
- 配置のやり方: クリップをコピー → コンソールで SetCurrentTimecode → Ctrl+V → Ctrl+D（クリップの長さを変更・フレーム指定）。ドラッグより確実。タイムラインの確認は tl:Export(OTIO) で行う（コンソールの Lua には io が無い）。
- 見本と比べて分かったずれ2点を修正（未コミット）:
  1. 字幕の帯: 見本は文字数で幅が変わるが、テンプレートは固定幅 → `poc/infographic/overlay.mjs` の見本側をテンプレートと同じ固定サイズに。強調テロップの帯・位置も .setting に合わせた。
  2. 音量: 就労者の書き出しが見本より +3LU・ピーク 0dBFS → `poc/scene/build_materials.mjs` で支給音声を -3dB（VOICE_GAIN_DB）。
  - 結果: 音量 -16.62 LUFS（見本 -16.67）、SSIM 0.908→0.933。残る差は字幕の改行位置（Resolve の自動折り返し）と会話図の細部のみ。
- 見本・素材・作業指示一覧を再生成し、テスト用パッケージ 02/03/04 に反映。検証書き出し: `C:\Users\yamat\Videos\新NISA_検証_v3.mp4`（修正前）/`_v4.mp4`（修正後）。

**操作動画（全7章・ナレーション付き）**
- `public/guide/video/{screen,import,arrange,subtitles,telop,audio,export}.mp4`＋同名 .jpg（合計約6.5分）。`src/lib/guide/chapters.ts` の各章に `video` を設定。
- 作り方: 画面録画（gdigrab）時に各ナレーションの開始秒を記録 → `node poc/guide/build_video.mjs <章> <録画.mkv> <segments.json>` で声を合成。
- 収録用プロジェクト「新NISA_教材収録」を新規作成。書き出し章の出力先は `C:\Users\yamat\Videos\絆_教材収録`（既存の Videos\新NISA_完成動画.mp4 を上書きしないため）。保存先ダイアログは個人フォルダ名が映るので録画では開いていない（ボタンを指すだけ）。
- `src/proxy.ts`: 認証除外の拡張子に mp4 を追加（画像と同じく公開の静的ファイル扱い。これが無いと未ログインのプレビューで動画が /login にリダイレクト）。
- tsc / eslint / vitest(74件) 通過。dev で /local-preview/guide/subtitles に動画が出ることを確認。

**実機で分かったこと**
- ［ワークスペース］→［スクリプト］は、コンソールで dofile した後だとメニューから起動しない状態になることがある（Resolve 再起動で解消）。
- Alt+F4 を送るときに前面が Resolve だと Resolve が閉じる（プロジェクトは無事）。

### 2026-09-18 — クレーム調査：「編集を完了してもAIレビューが始まらない／職員がどう操作するか分からない」（Claude）

**調査で判明した原因（実DB・RLS実挙動まで確認）**
1. **根本原因**: `submitWork`（`src/lib/actions/assignments.ts`）がAIレビュー下書きを**就労者セッションのクライアント**で `feedback` に insert していた。`feedback` の insert ポリシーは職員のみ（`00002_rls_policies.sql:109`）なので **42501 で拒否**。就労者アカウントで実挙動を確認済み（`new row violates row-level security policy for table "feedback"`）。
2. supabase-js は throw せず `{error}` を返すのに戻り値の error を見ておらず、**エラーが無言で消えていた**（ログにも残らない／画面は「提出できました🎉」）。
3. `/staff/reviews` は `feedback(pending_review)` 起点だったため、行が無い＝**職員の操作画面に何も出ない**。ダッシュボードの「レビュー待ち」も feedback カウントで0。`status='submitted'` の「提出を確認」ボタンの飛び先は `/staff/tasks/{taskId}`（教材編集画面）で提出物が見られない＝**完全な行き止まり**。
4. 見本との自動照合（`submission_inspections`）の登録条件は「その task_id を持つ `video_jobs` に `answer_data` がある」だが、実DBの video_jobs は**10件すべて task_id が NULL**。かつ新NISA案件は `scene_jobs` 由来で検品コードから未参照 → 検品ジョブは0件。
5. 仮に登録されても実処理は `scripts/video/inspect-worker.ts`（ffmpeg必須のローカルワーカー）で、**Vercelでは動かない設計**。
6. 期待との差: `gradeSubmission` は「動画ファイルの中身は見られないため」と明記したテキスト採点。機械検品も尺・解像度・映像/音声有無・音量の5項目のみ。テロップ文言や字幕タイミングの差分は未実装。
7. 差し戻し導線が無い（承認/破棄の2択のみ。破棄すると割当は `submitted` のまま一覧から消えて詰む）。
- 実データ: 提出1件（2026-09-03 `nisa_廣田貴彦.mp4` 36.7MB・storageに実在）、feedback 0件、submission_inspections 0件、割当は9/3から `submitted` のまま。

**修正（未コミット。ユーザー選択: 「まず土台を復旧」＋「自動で差し戻す」）**
- `src/lib/review/createAiReview.ts`（新規）: AIレビュー下書き作成を**管理クライアント(service role)**で行う。AI採点が落ちても下書き行は必ず作る。第2引数 `expectAssignmentId` で所有権を検証（IDOR対策）。
- `src/lib/review/autoReturn.ts`（新規・純関数＋テスト9件）: 自動差し戻しの判定。**確定した事実のみ**（セルフチェック未チェック／動画以外の拡張子／機械検品のfail）。**AIのテキスト採点スコアは根拠にしない**（動画を見ていない採点で誤差し戻しすると利用者を傷つけるため）。
- `src/lib/review/parseSelfCheck.ts`（新規・テスト5件）: self_check の形を検証して取り込む。
- `src/lib/actions/assignments.ts`: 上記を呼ぶよう変更。version は count ではなく max(version)+1。同一案件の60秒以内の再提出を拒否（連打でAI APIが無制限に走るのを防止）。検品スキップ時は console.info で記録。
- `src/lib/actions/staff.ts`: `reviewFeedback` → `submitReview`（合格/差し戻し/破棄の3択。AI下書きが無い提出物でも職員が自分で結果を書いて確定できる）、`runAiReview`（AIレビューの手動実行・再実行）を追加。score は 0-100 にクランプ。
- `src/app/staff/reviews/page.tsx`: **feedback起点 → 提出物起点**に作り替え。AIレビューが無い提出も必ず並ぶ。状態バッジ（AIレビュー未実施／AI下書き・承認待ち／AIが自動差し戻し済み・職員未確認）。最新versionのみ対象。
- `ReviewForm.tsx`（3ボタン化＋「直してほしいこと」入力）、`RunAiReviewForm.tsx`（新規）。
- 利用者側: `FeedbackView` に「🔁 なおして、もう一度ていしゅつしてください」表示。再提出直後は「いま採点しています」を上に出し、前回結果は下に残す。ステータス表記「レビュー結果あり」→「やり直し依頼中」。
- 職員ダッシュボード: 「レビュー待ち」を submitted＋自動差し戻し未確認に。導線を `/staff/reviews` に統一。
- **DBマイグレーションは追加していない**（差し戻し＝`assignment.status='feedback'`、AI自動差し戻し＝`feedback.status='approved'` かつ `reviewed_by=null` で表現）。

**検証**
- tsc / eslint / vitest 88件（新規14件）通過。
- 本番DBに対して `createAiReview` を実行し、feedback作成（以前は42501）・自動差し戻し（割当 submitted→feedback）・職員レビュー画面クエリの成立を確認。**テストデータは削除し、割当ステータスも元に戻した**。
- **未実施**: 画面の実機確認と「提出→自動差し戻し→再提出→職員が合格」の通しE2E（ログインが必要なため、ユーザーに依頼中）。

**レビュー指摘の反映（code-reviewer / security-reviewer を並行実行）**
- HIGH（code-reviewer）: 自動差し戻し→再提出のたびに、古い `approved & reviewed_by=null` の行が残り、ダッシュボードの「職員未確認」件数を恒久的に汚す。→ 件数を「最新の提出だけ」で数えるようJS側集計に変更（`src/app/staff/page.tsx`。COUNTクエリは削除）。状態判定は `src/lib/review/reviewState.ts` に切り出してテスト11件を追加。
- MEDIUM（security-reviewer）: `createAiReview` に所有権チェックが無くIDORの地雷 → 第2引数 `expectAssignmentId` を追加し、就労者経路（submitWork）から必ず渡すように。
- HIGH（security-reviewer）: `submitWork` にレート制限が無く、連打でAI採点APIが無制限に走る → 同一案件の60秒以内の再提出を拒否。
- MEDIUM（security-reviewer）: `self_check` のスキーマ未検証 → `parseSelfCheck`（テスト5件）で形を検証して取り込む。
- LOW: `submitReview` の score を 0-100 にクランプ。
- 未対応（判断）: `import "server-only"` ガード（`server-only` パッケージ未導入のため見送り）。`submitReview` の discard 時に割当ステータスを戻さない点（利用者側は `awaitingResult` で「採点中」表示になるため実害なし）。
- 既存の lint エラー1件（`src/components/QuestionForm.tsx` の setState-in-effect）と警告1件（`src/lib/scene/schema.test.ts`）は今回の変更とは無関係の既存問題。

**最終検証（本番DB・テストデータは削除済み、割当は submitted に復元）**
```
[1回目] autoReturned=true 割当=submitted→feedback
[2回目/再提出] autoReturned=false graded=true（職員の承認待ち）
[所有権チェック] 別の割当IDを渡すと拒否される（OK）
[レビュー画面] 最新の提出のみ対象（v3:draft_pending）
[ダッシュボード] 古い自動差し戻しは数えない → 未確認件数=0
```
tsc / vitest 100件 通過。

### 2026-09-18 — 手順書の置き換え＋本番デプロイ（Claude）
- 案件ごとの手順書（StepViewer・職員の手順エディタ・手順データの生成）を廃止。全案件共通の「作業のしかた」（src/lib/guide/workflow.ts ＋ components/work/WorkSteps.tsx）に置き換え。各ステップから操作動画をその場で再生／教科書の該当節へ。
- デプロイ: GitHub https://github.com/yamatotomaya3070-cell/next の main に push → Vercel の Git 連携で自動デプロイ（本番 Ready を確認）。ローカルのブランチ名も master → main に変更。
- 注意: Vercel CLI で直接デプロイすると poc/ や scripts/output（約5.8GB）まで送ろうとして、無料プランのアップロード上限（24時間で5000ファイル）に当たった。.vercelignore を追加済み。今後は push でデプロイする。
- 別セッションの AI レビュー機能（src/lib/review ほか）も、同じファイルに変更が入っていて切り離せなかったため一緒にコミット・公開した（既存の表だけ使用、DB 変更なし）。

### 2026-09-18 午後 — 「どのPCでも・支給素材から完成できる」の保証（Claude）
ユーザーの指摘: 書き出しプリセットはこのPCにしか無いのでは／これで本当に完成まで行けるのか。
調べた結果、本番では完成できない状態だった（本番の素材ZIPは8月版で場面の映像・OP/EDが無く、型・スクリプト・プリセットを他PCへ届ける手段も無かった）。

- 型・スクリプト・プリセット: 教科書 第10章からセットアップ用ZIP（public/guide/setup/kizuna_davinci_setup.zip）をダウンロード → bat。ZIPから展開した bat で導入できることを確認。プリセットが無いときの手動設定も教科書に記載。ZIP は scripts/scene/zipFolder.ts（UTF-8フラグ・/区切り）で作る。Compress-Archive(\区切り)・tar(Shift-JIS)は使わない。
- 登録前の関門 scripts/scene/verifyPackage.ts: 「絆_素材を並べる」と同じ計算(src/lib/scene/arrangeSimulation.ts)で並びを予測し、完成見本の長さ(±3f)・作業指示一覧とセリフの1対1・声のピーク(-2dB以下)を確認。registerSceneTask の最初で呼ぶので、合わない案件は登録されない。予測は実機 Resolve 21 の結果と1フレームも違わないことをテストで保証（fixtures/arrange-nisa-2026-09-17.json）。Resolve の数え方: 音声=floor(秒×24)、映像=実フレーム数、置かれる長さは n−1。
- 作業のしかた: 作業指示一覧を同じタブに表示／就労者が見られない完成見本に頼る文言を削除／自己チェックが編集指示書の表を読んでいた不具合を修正／YouTube動画生成以外の案件では自動で並べる手順を出さない。
- 生成側: 案件ごとの手順書を作らない・見本に場面名を入れない(既定OFF)・素材ZIPを実在ファイルで作る・説明文と提出名を題材から作る・完成見本の取り違えの逃げ道を削除。
- 本番データ: 新しい新NISA練習案件を関門つきで登録（56ec5dab-…）、同名の古い8/30版を削除。iDeCo は scene_jobs に残っていた設計図から新しい仕組みで作り直し中。8/16「新NISAって結局何？」は就労者の提出1件（レビュー待ち）があるため、削除は確認待ち。
- 案件を作る入口は4つ（YouTube動画生成／課題の新規作成／scripts/video の worker／CrowdWorks案件）。保証できるのは YouTube動画生成だけ。

## 2026-09-18 午後（確認のみ・変更なし）：手順書で完成できるか／このPCに依存していないか

依頼: 「現状の手順書で不愉快なく動画の完成ができるか」「このPCに依存していないか」の2点を確認。コード・本番は変更していない（.tmp_read に読み取り専用スクリプト list_tasks_ro.mts / list_old_ideco_zip_ro.mts を追加しただけ）。

確認した方法: 作業のしかた(workflow.ts)と教科書(chapters.ts)の全参照、セットアップZIPの中身(bat/Lua/.setting/.xml)、支給素材ZIPの中身、本番の案件と資料一覧(読み取り)、本番の操作動画7本とZIPの到達性、vitest 116件・tsc 通過、iDeCo v2 パッケージを関門にかけて OK（7965f／見本7967f、セリフ41本、映像13本）。実機 Resolve の通しは今回は行っていない（09-18 午前に本PCで検証済み）。

見つかったこと（手順で詰まる順）:
1. 本番に古い iDeCo（72688600、8/17、配布0）が残っている。素材ZIPは旧形式（場面の映像mp4なし・区切りが\・手順書.md入り）なのに media_url が scene-nisa/ なので「絆_素材を並べる」の手順が出る → 実行すると赤い「置けなかったもの」になる。配布すると必ず詰まる。iDeCo v2 は関門OKなので、登録して旧を削除すれば解消（前回の Exact Next Step のまま）。
2. 支給素材ZIPの「はじめに.txt」（build_materials.mjs）が「手順書.md を上から順番にやる」と書き手順書.md を列挙しているが、ZIPに手順書.md は無い（新NISA 56ec5dab・iDeCo v2 とも）。文面を「アプリの作業のしかた」に直して再ZIPが必要。
3. 教科書6章テロップの「始まりと終わりは作業指示一覧の補足に合わせる」は、アプリの作業指示一覧に「補足」欄が無いので合わない（CSVにはある）。作業のしかた本文とアプリ表は一致（文字がある行のセリフの頭から場面の終わりまで＝2つ目のセリフ）。CSVはテロップ文字が場面の1行目にあり、アプリ表は2行目にあるので読み分けに差がある。
4. 書き出しプリセット 絆_YouTube_720p.xml に RecordPrefix「新NISA_完成動画」と RecordTargetDir「C:\Users\yamat\Videos」が焼き込まれている。ファイル名と保存先は手順で入れ直すので実害は低いが、他題材でも初期値が新NISAになる。
5. ZIPに 図解/立ち絵/背景 フォルダと、CSVの「立ち絵素材名」「空ける間(フレーム)」列が残っている。作業のしかたでは使わない。
6. ワーカー(scripts/scene/worker.ts)は今も build_manual.mjs で手順書.md を作っている（ZIPには入らないので無害だが無駄）。

PC依存:
- 就労者の編集: どのWindows PCでも可。必要なのは Resolve 21 と教科書10章のZIP（本番で配信中・git管理・13KB）。bat は %APPDATA% 基準で固定パス無し。字幕の型と完成見本は同じ Yu Gothic UI（Windows標準）。Mac は手コピーで字体も変わる。
- アプリ本体: Vercel＋Supabase。本番 = git 696f5a0 = origin/main。
- 依存が残る所: (a) 「YouTube動画生成」の処理は職員PCのワーカー常駐が前提（start-worker.bat）。今この PC でもワーカーは起動していない（next dev だけ）ので、職員がジョブを作っても「待機中」のまま。Docker版は SCENE パイプラインで未検証（Linux は Noto フォントになり見本の字体が変わる、gen_intro_outro の SAPI 代替は Gemini キーがあれば不要）。(b) セットアップZIPの元ファイル 05_テンプレート（bat/Lua/.setting/.xml）は .gitignore で git 管理外＝この PC の OneDrive にしか無い。(c) iDeCo v2 の作り直し結果は poc/scene/out（git管理外）にしか無い。

## 2026-09-18 夕方 — メッセージをLINE風チャットに作り替え＋利用者メニュー統合（Claude）

依頼: /messages が見えにくいので LINE のようなチャット形式に。職員は利用者ごと、利用者は /messages から送信できる形。あわせて利用者メニューの「受注案件/作業中/提出/修正依頼/実績」は「受注案件」1本にまとめ、ページ内で「未着手/作業中/レビュー待ち/修正依頼/完了」に絞り込む。

- **データ**: 旧 qa_logs は「質問1:回答1」でチャットにならないため、`supabase/migrations/00020_messages.sql` で `messages`（1行=1発言、trainee_id=トークの持ち主、sender_kind trainee/staff/ai、sender_name はスナップショット、read_at=相手が読んだ時刻）を新設。RLS は利用者=自分のトークのみ／職員=全部、update は read_at 列だけ許可。Realtime publication に追加。既存 qa_logs の質問→利用者の発言、回答→職員/AIの発言として取り込む（qa_logs は残す・以後は書かない）。**本番 Supabase への適用は未実施（SQL Editor で 00020 を流す必要あり）。未適用のまま開くと「migration 00020 未適用」の案内が出る。**
- **画面**: `src/components/chat/`（ChatFrame/ChatThread/MessageBubble/ChatComposer/DateDivider/useLiveMessages）。吹き出し（自分=右・青、相手=左・白、AIはロボットアイコン）、日付区切り、既読、案件タグ、下部固定の入力欄（Enter送信・Shift+Enter改行・IME確定Enterは送らない）。新着は Realtime＋8秒ポーリング、開いたら相手の発言を既読化。
  - 利用者 `/messages`: 職員との1本のトーク。案件は入力欄上の「案件を選ぶ（任意）」で付けられる。
  - 職員 `/staff/messages?user=<id>`: 左に利用者一覧（未読数・最終メッセージ・未読優先の並び）、右にトーク。スマホは一覧かトークの一方のみ（←で戻る）。
  - 職員ホーム: 「未回答の質問」→「未読のメッセージ」（クリックでそのトークへ）。AnswerForm と answerQuestion は削除。案件詳細の「質問する」フォームは messages に書くよう変更（返事は /messages に届く旨を表示）。
- **メニュー統合**: TRAINEE_NAV から作業中/提出/修正依頼/実績を削除し「受注案件」のみ。サイドバーは `?status=` 付きでも受注案件をアクティブ表示。/works の絞り込みチップに状態ごとの件数を表示。
- **検証**: vitest 129件（messages ヘルパー13件追加）、tsc、eslint（新規エラー0）。dev 限定 `/local-preview/messages`（`?as=staff`）で PC 幅・390px 幅とも目視確認、送信→吹き出し追加→最下部追従を確認。ログイン後の実ページは migration 未適用のため未確認（ユーザー側で 00020 適用後に /messages・/staff/messages・/works を確認してください）。
- 未コミット・未デプロイ（指示待ち）。開発サーバーは既存の 3124 を利用。

## 2026-09-18 夕方：ワーカーPCのセットアップを「教科書からダウンロード→bat 1つ」に（bdbb690、push 済み）

背景: 案件を作る工程（YouTube動画生成）は、Vercel ではなく職員PCで常駐する「ワーカー」が処理する。ユーザーの開発機はノートPCで持ち運ぶため、クライアント側の常時起動PCにワーカーを置く必要があり、非技術者の職員でも入れられる形が要る。クリーン複製（git 管理下のファイルだけ）で試したところ、立ち絵14枚（poc/character/out/cutout/reel）が無く会話場面の描画モジュールの読み込みで即エラーになった。立ち絵を入れると13場面中12場面まで描画が進んだ（PCのメモリ不足でシステムに止められたため最後までは未確認）。

やったこと:
- scripts/worker-setup/: セットアップ（職員用）.bat → setup.ps1（winget で Git/Node.js LTS/ffmpeg 導入 → git clone/pull → npm install → 設定ファイル配置（隣の「設定ファイル.txt」を使う、無ければ3値を聞く）→ checkWorkerSetup → スタートアップとデスクトップにショートカット → 起動）。更新（職員用）.bat は同じスクリプト（動いているワーカーを窓の題名「絆ワーカー」で見つけて taskkill /T してから更新）。ps1 は UTF-8 BOM、bat は UTF-8 + chcp 65001 + CRLF
- scripts/scene/checkWorkerSetup.ts: Node20+/ffmpeg/ffprobe/sharp/立ち絵14枚/assets/設定3項目/Supabase(scene_jobs)/Gemini(models 一覧) を ○× 表示。tsx はトップレベル await 不可なので main() に包む
- scripts/scene/buildWorkerSetupZip.ts → public/guide/setup/kizuna_worker_setup.zip（5KB）。教科書 第11章「案件を作るパソコンの準備（職員の方へ）」からダウンロード
- 立ち絵を git 追跡に（.gitignore を poc/**/out/* に変え、cutout/reel だけ再包含）。公開リポジトリなので clone だけで揃う
- 検証: tsc/eslint/vitest 129 件通過。ZIP を展開した setup.ps1 をクリーン複製に対して実行（-NoStartup -NoStart）し、pull→npm install→設定維持→確認 全○→完了まで通った。ショートカット作成の COM も動作確認。winget による新規インストールと実際のスタートアップ登録は本機では未実施（ツールが入っているため）

未対応（ユーザー判断待ち）:
- クラウドワークス案件では「字幕を入れる」「強調テロップを入れる」の文が絆の型前提のまま。依頼主の指定に合わせて型の見た目を変える文と教科書の節が必要
- 旧 iDeCo(72688600) の置換、はじめに.txt の文面、教科書6章テロップの「補足」文言、プリセットXMLの初期値（午後の確認で挙げた4点）

## 2026-09-18 夕方②：クラウドワークス案件の「字幕」「強調テロップ」を、絆の型前提から「依頼主の指定に合わせる」手順に

- workflow.ts の MANUAL_ARRANGE（autoArrange=false のとき）に subtitles / telop を追加。字幕は［テキスト］を置いてインスペクタで見た目を合わせ、1つ目をコピーして使い回す。テロップは依頼内容に指定がある場面だけ。文字の出どころは「作業指示一覧」ではなく依頼書・台本
- 教科書 5章に節 subtitles#custom「外部のお仕事：型を自分で作って見た目を合わせる」、6章に telop#custom「外部のお仕事：指定に合わせてテロップを作る」を追加（画像なし・手順のみ。インスペクタの項目名は フォント／サイズ／カラー／位置／ストローク／ドロップシャドウ／背景）
- テスト: workflow.test.ts に「それ以外の案件では字幕とテロップが絆の型に依存しない」を追加。vitest 130件・tsc・eslint 通過
- 未実施: 新しい2節の実機画像の撮影（DaVinci を開ける時に撮って image を付ける）

## 2026-09-18 夜：外部案件の字幕・テロップの節に、実機の画面写真を追加

- Resolve 21 を実機操作（ユーザー許可）。空の検証プロジェクト「新NISA_別PC想定_125834」に、コンソール(Lua)で新NISA S01 の映像1本＋セリフ4本を取り込み、タイムライン「外部案件の例」を作成。GUI で［テキスト］を V2 に置き、文字入力→サイズ60→位置Y=90→ストローク4→Ctrl+C/Ctrl+V で2つ目→V3 にテロップ（位置Y=620）まで行い、各段階を撮影
- 画像5枚（public/guide/img/ext_text_place / ext_text_look / ext_text_position / ext_text_copy / ext_telop .jpg）。1920x1200 のフル解像度からタスクバーを除いて 1280x752 に縮小し、赤い枠＋番号を System.Drawing で描画（scratchpad/annotate_bom.ps1、ps1 は UTF-8 BOM 必須）
- 5章の subtitles#custom を4節に分割（①置く／②文字の見た目／③位置と縁取り／④コピーで増やす）。6章 telop#custom に画像。作業のしかたの参照 subtitles#custom / telop#custom は据え置き
- 実機で分かった注意（教科書にも記載）: インスペクタの数字欄で Ctrl+A を押すとタイムラインの全クリップが選択され、変更が全部に入る。数字欄はクリックしてそのまま数字を打つ。{END}/{BACKSPACE} もタイムラインに飛ぶ
- 検証プロジェクトは保存して Resolve を最小化に戻した（タイムライン「外部案件の例」は残置）

## 2026-09-18 夜②（確認のみ）：リリース可否と要件の到達度

- 本番: git 041e590 = Vercel Ready。DB は 00001〜00020 のうち real_cases / material_answers / video_templates / practice_jobs の4テーブルが無いが、現在の画面はどれも参照していない（practice_jobs は actions のみで UI 無し）。messages(00020) は適用済み（11件）。
- 本番データ: 職員1・利用者1、案件2（新NISA=本日16:59に利用者へ配布 in_progress、旧iDeCo=旧形式のまま残存）、提出0、scene_jobs に「相続税」2件が本日から待機中（ワーカー未起動のため）。
- 結論: 練習LMS＋絆案件の範囲は「条件付きで可」。塞ぐべきは ①ワーカー常駐先の決定と起動 ②旧iDeCo置換 ③支給ZIPの はじめに.txt。要件定義書v2のフェーズ2（アプリ内エディタ）は 07-20 にスコープ外決定、フェーズ3のメール自動取り込み・フェーズ4の LINE は未実装。Astra6 指示書の完了条件16項目は 11✅ 3⚠️ 2❌（教材のバージョン管理・教材進捗の職員確認）。

## 2026-09-18 夜③：iDeCo案件の作り直しと相続税2件の生成（このPCでワーカーを一時起動）

- 調査: 「動画が生成されない」原因は scene worker が1台も動いていなかったこと。タスクスケジューラ KizunaVideoWorker は旧 video_jobs 用（15分ごとに「処理待ちなし」）で scene_jobs は見ない。絆_素材を並べる.lua は S01_*.mp4 / S01_01_*.wav / オープニング / エンディング / BGM を探す設計で、b13d93e（映像mp4素材）以降に生成した案件なら全部並ぶ。旧形式（図解PNGのみ）の既存案件では映像が並ばない
- 削除: 旧 iDeCo 案件 tasks 72688600（割当0・提出0）、Storage scene-nisa/72688600/{sample.mp4,assets.zip}、scene_jobs 1eb3f02b / bfbb0500。新規 scene_jobs 69577ea6（iDeCo・投資初心者・6分・難易度3）を pending 登録
- 相続税は2件とも別条件（0837b376=会計士・難易度4、bfcd66fb=投資初心者・難易度3）なので両方処理
- 失敗と復旧: Bash ツール経由で起動した worker を止めた際に子プロセス起動が壊れ、3件が render_project で即失敗 → 3件を pending に戻し、PowerShell Start-Process（隠し窓）で `npm run scene:worker`（--watch なし＝処理後に自動終了）を起動。ログ scripts/output/scene-worker-2026-09-18_run2.log
- 速度: 1件40分前後（12シーン）。描画は1コア占有の逐次処理（1フレーム2枚PNG化）で、しかもバッテリー駆動だった。AC接続を依頼。根本対策はシーン並列化（未着手）
- 修正: render_project.mjs の TTS プロンプト。「ミナ先生、今日もありがとうございました！」を Gemini TTS が自分宛ての会話と誤解し 400「Model tried to generate text」→無音1.5秒になっていた。「あなたは声優です。次の【読み上げ原稿】を一字一句そのまま…」に変更し、単体で通ることを確認。エラー本文もログに出すようにした。相続税(会計士)の1件目は修正前に走ったため S12 の4行目が無音（要再生成）
- 完了: 相続税(会計士) task=757a4a2b。素材/映像 は S01〜S12 全部 mp4＋オープニング/エンディング（Lua対応形式の初案件）。S12 の1行だけ無音
- 失敗2: 相続税(初心者) bfcd66fb が worker.ts の rmSync(poc/scene/out/work) で EPERM。原因は OneDrive 配下で数万枚のフレームPNGを同期中に消せないこと（bash 経由の逐次掃除も効いていなかった）。手で work を消して iDeCo は続行、bfcd66fb は failed で一時保留 → iDeCo 完了・ワーカー自然終了後に pending へ戻して新コードで再起動する
- 修正2: worker.ts の作業フォルダを os.tmpdir()/kizuna-scene（SCENE_WORK_ROOT で変更可）に移し、render_project / build_materials へ SCENE_WORK_DIR / SCENE_VOX_DIR / SCENE_VISUAL_ASSET_DIR で渡す。rmSync は maxRetries=10。render_project.mjs のフレーム掃除を bash rm → readdirSync/unlinkSync に変更。tsc・node --check・空起動OK。未コミット
- 完了(21:14): iDeCo task=247d0734（14シーン・4分48秒・無音なし）、相続税(初心者) task=77f29a8b（12シーン・4分28秒・無音なし、修正版コードで生成。Temp/kizuna-scene で描画、フレーム掃除も効いて残り29ファイル）。ワーカーは自動終了（run3 ログ）。AC電源＋Temp では1件25分程度
- 残課題: ①相続税(会計士) 757a4a2b の S12 無音1行（再生成するか判断待ち）②render_project.mjs / worker.ts の修正をコミット・push（職員PC導入前に必須）③scene worker の多重起動対策（locked_by 条件・stale 引き継ぎ）④シーン並列化で高速化

## 2026-09-19 深夜：相続税(会計士)の再生成と修正のコミット

- 旧 task 757a4a2b（S12 無音1行）と Storage を削除し、scene_jobs 0837b376 を pending に戻して修正版ワーカーで再生成 → task=edb85915（12シーン・3分32秒・セリフ26本・無音なし）。ワーカー自動終了
- コミット 1e39e9d を origin/main へ push（render_project.mjs の TTS 指示＋フレーム掃除、worker.ts の作業フォルダ移設＋rmSync 再試行、作業ログ）。vitest 130件通過
- 残課題: scene worker の多重起動対策（claim 条件に locked_by is null／stale 引き継ぎ）、シーン並列化

## 2026-09-19 昼：完成見本が利用者に一切表示されない不具合の修正

- 報告: 職員画面の「完成見本の公開範囲」を「提出前から公開」にしても利用者に見本が出ない
- 原因: e2672b2（08-17）で利用者ページ src/app/(trainee)/tasks/[id]/page.tsx の配布判定が「source_assets のみ」に固定され、visible_before_submission と提出済みの判定が消えていた。職員側の切替（setSampleVisibility）は DB を正しく更新していたが、利用者側が値を見ていなかった
- 修正: 判定を src/lib/tasks/pickMaterials.ts の pickDownloadableMaterials に切り出し（支給素材=常に配布、完成見本=「提出前から公開」なら即、「職員のみ」なら提出後に配布）。vitest 4件追加（134件通過）。setSampleVisibility は update エラーを握りつぶさず throw するように変更。eslint/tsc 通過。コードレビュー承認 → コミット cdd6ecb を origin/main へ push、Vercel 本番 Ready（kizuna-video-training-yamato2.vercel.app）
- 注意: scripts/scene/registerSceneTask.ts が生成する案件は既定で「職員のみ（提出後に公開）」。提出前から見せたい案件は職員画面で切り替える
- 確認(本番DB): 新NISA案件 56ec5dab の完成見本(f0c6eae7)は既に visible_before_submission=true（職員の切替は保存されていた）。Storage に sample.mp4(10MB)/assets.zip(18MB) あり、割当1件(in_progress・提出0)。修正版デプロイ後は利用者の「素材ファイル」欄に見本が出る状態。他3案件（iDeCo・相続税×2）は「職員のみ」のまま・割当0

## 2026-09-21 深夜：提出後AI検品の段階1（配線）＋段階2（セリフ音声の構成照合）

- 背景: 提出後のAIレビューは「セルフチェック未チェック／動画以外の拡張子」だけで自動差し戻ししており、機械検品(submission_inspections)は提出時に pending 行を作るだけで結果が差し戻し判定に届いていなかった。検品ワーカーも常駐バッチに入っておらず、対象も video_jobs の正解データがある案件だけ（主力のSCENE案件は対象外）だった
- 段階1（配線）
  - `src/lib/review/inspectionTarget.ts`（新規）: 突き合わせ先を案件から決める。video_jobs.answer_data（template）→ 無ければ task_materials kind=sample（完成見本）＋ source_assets（支給ZIP）。submitWork の検品登録条件もこれに統一（`isInspectableTask`）
  - `src/lib/video/inspection/compareSample.ts`（新規・テスト5件）: 正解データ表を持たないSCENE案件用に、完成見本を実測した値を期待値にする（尺±2秒／解像度一致／映像・音声あり／平均音量±6dB）
  - `src/lib/review/applyInspection.ts`（新規・テスト5件）: 検品完了時にAI下書きへ結果を反映し、fail があれば自動差し戻し（approved & reviewed_by=null、理由を先頭に）。AI採点は再実行しない。職員確定済みなら触らない。下書きが無ければ createAiReview で作り直す
  - `scripts/video/inspect-worker.ts` 書き換え: target 別の比較、完了時に applyInspectionResult、`--watch` 常駐モード。`start-worker.bat` は動画生成＋検品の2ウィンドウ起動に変更
  - `CheckItem.message`（任意）を追加し、autoReturn は fail 項目にこれがあればそのまま利用者向け理由に使う
- 段階2（構成照合）
  - `src/lib/audio/fingerprint.ts`（新規・テスト4件）: 外部依存なしの星座型（Shazam式）音声指紋。8kHz mono／窓1024／hop256、帯域6分割ピーク→ペアハッシュ(f1,f2,Δt)→オフセット投票。閾値 score≥0.25・coverage≥0.5、2回目以降の一致は最良の40%以上（重複検出用）
  - `src/lib/video/inspection/structure.ts`（新規・テスト8件）: セリフ音声の「入れ忘れ／重複／順番／間隔(±1.5秒)」を CheckItem 化。利用者向け文言はセリフ名（S06_03（ミナ先生））と分秒つき。抜けたセリフの前後の間隔は二重指摘しない
  - `scripts/video/{unzip,pcm,structureCheck}.ts`（新規）: 純Node の ZIP 読み出し、ffmpeg→PCM、支給ZIPの `S**_**_*.wav` を取り出して見本と提出の両方で位置を探す
  - `scripts/video/smoke-structure-check.ts`（新規・DB不要）: パッケージフォルダから「見本そのまま／セリフ1本切り落とし／セリフ1本重ね」の提出を ffmpeg で作って照合する
- 検証: tsc・eslint 通過、vitest 156→164件通過。実データ（poc/scene/out/就労者パッケージ_新NISA、5分22秒・セリフ39本）で ①見本そのまま=9項目すべてOK（見本内で39/39本検出、最低スコア0.42、最低カバー率0.83、処理84秒）②S06_03 を切り落とし=「入れ忘れ NG（足りない: S06_03（ミナ先生））」＋尺NG ③末尾に重ね=「重複 NG（S06_03が2回）」＋尺NG。再エンコード(libx264/aac)済みの提出でも一致した。ログ scripts/output/smoke-structure-nisa.log
- 未実施: 本番DBでの通し（提出→ワーカー検品→自動差し戻し→再提出）。常駐PCで start-worker.bat を起動すれば動く。未コミット
- 次: テロップ検品（段階3）、見本フレーム差分・スタイル判定（段階4）、わざとミスを入れた提出セットの自動生成と精度測定（段階5）
- コードレビュー（code-reviewer）対応: ①HIGH 検品中に再提出されていたら古い結果で差し戻さない（applyInspectionResult が同じ割当の新しい version を確認してスキップ）②`--job` 実行時も locked_at の条件つきでクレーム（常駐ワーカーとの二重処理防止）③inspectionTarget は is_approved=true の見本だけ使う ④failed は retry_count<3 なら自動で拾い直し、check_result 保存→反映→completed の順にして途中で落ちても拾い直せるようにした

## 2026-09-21 昼〜午後：提出後AI検品の段階3（セリフ字幕＝テロップの照合）

- 段階3（字幕照合）
  - `src/lib/video/inspection/telop.ts`（新規・テスト12件）: 純関数。作業指示一覧（CSV／Markdown表）から「音声ファイル→字幕の文」を読み、OCR結果と比べて「字幕の入れ忘れ（telop_present）」「字幕の文（telop_text）」を CheckItem 化。類似度 0.85 以上=一致、0.5 未満=明らかに違う（fail）、その間=unknown（職員確認、差し戻し文言なし）。句読点・空白・全角半角は無視、話者ラベルの混入は除去。利用者向け文言はセリフ名＋分秒（例「S06_03（ミナ先生）: 2分35秒あたり」）
  - `scripts/video/telopOcr.ts`（新規）: ffmpeg で画面の下30%を幅720に切り出し、Gemini（gemini-2.5-flash、GEMINI_OCR_MODEL で変更可）に12枚ずつまとめて JSON で読ませる。GEMINI_API_KEY が無ければ null → unknown 扱い
  - `scripts/video/telopCheck.ts`（新規）: 構成照合で分かった提出動画内のセリフ位置を使い、セリフの真ん中で1枚、文字が無かったものだけ 30%・70% の位置で追加2枚を OCR
  - inspect-worker.ts / smoke-structure-check.ts に組み込み。スモークにケース4（字幕を黒く塗りつぶし）・5（別の文を drawtext で上書き）を追加
- 12:29 の初回スモークは 1ケース目通過後に Gemini への fetch が HTTP2 refused stream で落ちて中断（コードの不具合ではなく通信）。対策として telopOcr.ts に再試行を追加（fetch failed／429／5xx を最大3回、2秒→4秒待ち）
- 検証（再実行、ログ scripts/output/smoke-telop-variants-run2.log）: tsc・eslint・vitest 168件通過。実データ新NISA（5分22秒・セリフ39本）で ①見本そのまま=11項目すべてOK（39本OCR、文字なし0）②S06_03 切り落とし=「セリフの入れ忘れ NG」③末尾に重ね=「セリフの重複 NG」④字幕塗りつぶし=「字幕の入れ忘れ NG（S06_03: 2分35秒あたり）」⑤字幕を別の文に=「字幕の文 NG（OCR文→指示文を併記）」。誤検知なし。各ケース約290秒（構成照合＋OCR）
- 気づき: 長い ffmpeg 処理の後の最初の Gemini 呼び出しは毎回「fetch failed」になり再試行1回で通った（5ケースとも同じ）。接続の使い回しが切れているためと思われ、再試行は必須
- 未コミット（段階1〜3すべて）。未実施: 本番DBでの通し（常駐PCで start-worker.bat 起動が必要）
- 次: 段階4（見本フレーム差分・スタイル判定）、段階5（わざとミス入り提出セットの自動生成と精度測定）

## 2026-09-21 午後：検品ワーカーを職員が入れられる形に（セットアップZIP・教科書第11章・レビュー画面）

- 前提: 職員向けセットアップZIP（教科書第11章）は setup.ps1 → start-worker.bat をスタートアップ登録する作りで、start-worker.bat は 09-21 深夜の段階1で「YouTube動画生成」＋「提出動画の検品」の2窓起動に変更済み。つまり仕組みとしては同じZIPで検品ワーカーも入るが、説明・準備チェック・画面が動画生成だけの前提だった。さらに段階1〜3が未コミットなので、職員PCが git pull しても検品ワーカーのコードが来ない
- scripts/scene/checkWorkerSetup.ts: 「検品ジョブの表（submission_inspections を読める）」を追加。本機で全○
- scripts/worker-setup/: 読んでください.txt を2ワーカー前提に書き直し（何をするか／窓が2つ／提出物レビューで確かめる／「順番待ち」のまま=ワーカー停止）。setup.ps1 の見出し・ショートカット説明・完了メッセージ、セットアップ.bat の rem も同様
- 教科書第11章（src/lib/guide/chapters.ts）: 題を「案件を作る・提出動画を検品するパソコンの準備」に。なぜ必要か（検品ワーカーの説明を追加）／確かめ方（窓2つ、提出物レビューに5分前後で結果）／困ったとき（「順番待ち」も）。ZIPサイズ表記 5KB→6KB
- 職員の提出物レビュー画面（src/app/staff/reviews/page.tsx）: 機械検品が pending/processing のとき「長く順番待ちのままなら検品ワーカーのパソコンが動いていません（教科書 第11章）」のリンクを追加
- ZIP 作り直し: public/guide/setup/kizuna_worker_setup.zip（6KB・4ファイル）。Expand-Archive で日本語ファイル名が正しく展開されることを確認
- 検証: tsc・eslint・vitest 168件通過
- 残: 段階1〜3＋本日分のコミットと origin/main への push（push で Vercel 本番に反映、職員PCの「更新（職員用）.bat」で検品ワーカーが入る）。その後、常駐PCで更新 bat → 提出→自動照合→差し戻しの通し確認
- コミット 7ef0742（検品 段階1〜3）・9c7995a（ワーカーセットアップ更新）を origin/main へ push
- ZIP の実効性確認: push 後に HEAD の kizuna_worker_setup.zip を展開し、設定ファイル.txt を添えて setup.ps1 -NoStartup -NoStart をクリーンな別フォルダに実行 → clone 9c7995a → npm install（423 packages, 2分）→ 準備チェック 10項目すべて○（検品ジョブの表も○）→ 完了。複製内で inspect-worker.ts を単発実行し「処理待ちの検品ジョブはありません」で正常終了。start-worker.bat も検品ワーカーの2窓起動を含むことを確認
- 未確認: Vercel 本番の反映（本番URLは SSO で保護されており curl では見えない。ブラウザで教科書第11章のZIPが6KB表記になっていれば反映済み）
- 本番反映の確認（Chrome・職員ログイン後）: デプロイは 9c7995a（Vercel API で確認）。教科書第11章は新しい題と「（ZIP・6KB）」表記で表示され、ボタン先の実ファイルも 6002 バイト・application/zip で配信。本番URLは Vercel のデプロイ保護＋アプリのログインの二重で守られており、curl では /login へ転送される

## 2026-09-21 夕方：職員ダッシュボードを「今日やること」1画面に再構成

- 発端: 職員ダッシュボードが縦7ブロック＋右パネル4枚で2.5〜3画面分スクロールしていた。原因は量より重複（レビュー待ちが3か所、AI評価・移行判定が2テーブル、常に100%の「配布済み」ドーナツ、準備中のCrowdWorks空箱、サイドバーと二重のクイックアクション）と、毎日見る対応と月次で見る分析の混在
- 方針（ユーザー選択）: A「今日やること中心に再構成」＋分析系は別ページ「実績・分析」を新設
- 集計を純関数へ分離: `src/lib/staff/dashboardStats.ts`（テスト13件）。利用者ごとの stats（進捗・AI平均・完了件数・修正回数・納期遵守・移行判定）、「今日やること」TodoItem（提出あり→期限超過→AI差し戻し未確認→AI下書き承認待ち→本日期限→未読メッセージ（利用者ごとに1行）→案件なし の優先順、同順位は古い順）、要対応の件数、配布回収の内訳、AI添削のよくある指摘。レビュー系は reviewState.ts の判定を再利用し、再提出で置き換わった古い提出は数えない。`reviewStateOf` の引数型を Pick<Feedback,"status"|"reviewed_by"> に広げた（挙動変更なし）
- DB読み込みを共通化: `src/lib/staff/loadDashboardData.ts`（ダッシュボードと実績・分析の両方が使う。feedback は approved/pending_review をまとめて1クエリに）
- 新ダッシュボード `src/app/staff/page.tsx`: 上段「要対応」帯（ActionStrip.tsx: 件数チップ6種＋稼働中／練習／本番／移行候補の小さな数字＋実績・分析へのリンク）、左「今日やること」（TodoList.tsx: 8件まで表示、残りは details で折りたたみ）、右「利用者の状況」（TraineeRoster.tsx: 名前・現在の案件・状態バッジ・進捗ミニバー、560px超はカード内スクロール）。右パネル（aside）は廃止
- 新ページ `/staff/reports` 実績・分析（`src/app/staff/reports/page.tsx`）: 配布・回収状況（「配布済み」→「作業中」に置換）、本番移行判定（全員・完了件数列を追加）、AI添削でよくある指摘、CSV出力（ExportReportButton.tsx をここへ移動）。サイドバーに「実績・分析」を追加
- 削除: `src/app/staff/TraineeProgressTable.tsx`（新ロスターで置換）
- 検証: tsc・eslint・vitest 194件通過。実画面はローカル dev（localhost:3000）で確認予定（要ログイン）。未コミット
- code-reviewer 指摘への対応: ①feedback の読み込みを approved(300)/pending_review(100) の2クエリに戻し、承認済みの量で承認待ちが押し出されないようにした ②やり直し依頼中(feedback)で期限超過の案件も「期限超過」に出す（旧画面は not_started/in_progress のみ）。意図的な拡張としてテストで固定 ③buildTraineeStats を feedbackByUser/latestProgressMap/maxVersionMap/onTimeRateOf に分割。再検証 tsc(本機能分)・eslint・vitest 13件通過
- 注意: tsc で scripts/video/frameCheck.ts(85) に Buffer 型エラーが1件出ている。これは別作業（検品 段階4）の未コミットファイルで本件とは無関係

## 2026-09-21 夕方：提出後AI検品の段階4（見本フレーム照合・字幕の位置判定）

- `src/lib/video/inspection/frames.ts`（新規・テスト14件）: 純関数。縮小グレースケール同士の「平均を引いた正規化相関」で類似度を出し、冒頭のオープニング(frame_opening)／末尾のエンディング(frame_ending)／場面の映像(frame_scene)を判定。類似度 ≥0.75=同じ、<0.45=明らかに違う、間=unknown。場面は「その場面の全アンカーが明らかに違う」ときだけ fail（一部なら unknown）。字幕帯の白い文字行（輝度≥225 が幅の1%以上）の範囲から字幕の位置・大きさ(telop_style)を比べ、中心差>6% か 高さ比が[0.6,1.6]外を「違う」とし、3本以上かつ半数以上なら fail
- `scripts/video/frameCheck.ts`（新規）: 動画を1回だけデコードし fps=2・640x360 gray を流して必要な時刻だけ拾う（`extractGrayFramesAt`）。上70%=映像、下30%=字幕帯。アンカーは オープニング(1s,3s)／エンディング(末尾-1.5s,-3.5s)／各場面の最初と最後のセリフの真ん中（構成照合の位置を使う）。提出側は±1秒の5フレームの最大類似度。字幕位置も提出側は見本に一番近いフレームを採る（0.5秒格子のずれで切り替わりの瞬間を拾う対策）
- 最初は1枚ずつ `-ss` シークで取り出したが、完成見本はキーフレームが極端に少なく1ケース822秒かかり、256幅では白文字が薄まって字幕行を24本中4本しか読めなかった → 上記の方式に変更（5分動画のデコード6秒、字幕行は23/24本）
- inspect-worker.ts / smoke-structure-check.ts に組み込み。smoke に変種6（場面の映像を別時刻の映像に差し替え）・7（字幕帯を全体的に10%上へ移動）と `--cases 6,7` の絞り込みを追加
- 検証: tsc・eslint・vitest 195件通過。実データ新NISAで ①見本そのまま=15項目すべてOK（類似度すべて1.00、字幕位置23本読み取り、1ケース312秒） ②切り落とし ③重複（末尾のエンディングNGも正しく検出） ④字幕塗りつぶし ⑤字幕別文 はすべて期待どおり。⑥場面差し替え ⑦字幕移動 は、スモーク実行中にPCのメモリ不足でプロセスが止められ未実施（ログ scripts/output/smoke-frames-variants.log）
- 残: ⑥⑦の実行（`npx tsx scripts/video/smoke-structure-check.ts poc/scene/out/就労者パッケージ_新NISA --cases 6,7`、約15分）、段階4のコミット

## 2026-09-22 未明：段階4の残り検証（ケース6・7）と字幕行検出の修正

- `--cases 6,7` で実行 → ⑥場面S06（141.7〜163.1秒）の映像を別時刻に差し替え=「場面の映像 NG（S06 2分25秒あたり）」（差し替えた映像に元の字幕が焼き込まれているため字幕の文NGも同時に出る。これは加工方法による副作用で正しい）⑦字幕帯を10%上へ=「字幕の位置・大きさ NG（23本中23本）」。どちらも期待どおり。ログ scripts/output/smoke-frames-cases67.log
- 気づき: ⑥で S09_01 の字幕位置が1本だけ「少し違うかも(??)」になった。原因は字幕帯の上部にある薄く明るい図形（1行あたり明るい画素3〜17）を「一番長いかたまり」として拾い、字幕本体（29〜113）を採っていなかったこと。再エンコードで閾値付近の値が揺れて見本と提出で別のかたまりを選んでいた
- 修正: frames.ts の detectTextBand で、文字行の閾値を幅の1%→3%に、かたまりの選び方を「長さ」→「明るい画素の合計」に変更。見本／再エンコード版とも同じ位置（85.6〜89.2%）を指すようになった
- 修正後の通し（scripts/output/smoke-frames-final.log）: ①〜⑤すべて期待どおりで「??」ゼロ（字幕位置 24/24 読み取り）。⑥⑦はこの通しの途中でPCのメモリ不足によりプロセスが止められ、修正後コードでは未再実行（前回の実行では期待どおり）
- smoke の `--cases` の値が提出動画名として拾われるバグを修正（args から除外）
- 1ケースの処理時間: 約300〜320秒（構成照合＋OCR＋映像照合）
- vitest 195件・tsc・eslint 通過。段階4をコミット（未push）
- 5af8aca（段階4）を origin/main へ push。職員PCは「更新（職員用）.bat」で検品ワーカーに映像照合が入る
- 本番ビルド失敗と復旧: 5af8aca の Vercel ビルドが ERROR。原因は、別作業（職員ダッシュボード整理、09-21 16時台・未コミット）で index に載っていた「src/app/staff/TraineeProgressTable.tsx の削除」「ExportReportButton.tsx → reports/ への移動」が、段階4のコミットに紛れ込んだこと（コミット済みの staff/page.tsx はまだ両方を import している）。2ファイルを 9c7995a の内容に戻すコミット 20202af を push → Vercel READY（15:14）。ローカルの未コミット作業（page.tsx 分割・ActionStrip/TodoList/TraineeRoster/reports/page.tsx・src/lib/staff）はそのまま残してある
- 教訓: この作業ツリーは他の作業者（Codex等）が index に変更を残すことがある。コミット前に `git diff --cached --stat` を見るか、`git commit -- <paths>` でパスを限定する
- 修正後コード（20202af）で `--cases 6,7` を再実行（scripts/output/smoke-frames-cases67-final.log）: ①見本そのまま=全OK ⑥場面差し替え=「場面の映像 NG（S06）」 ⑦字幕10%上=「字幕の位置・大きさ NG（24本中24本）」。3ケースとも字幕位置は 24/24 読み取りで「??」なし。これで7ケースすべて最終コードで確認済み

## 2026-09-22 午後：提出後AI検品の段階5（わざとミス入り提出セットの自動生成と精度測定）

- `scripts/video/localInspection.ts`（新規）: パッケージフォルダ＋提出mp4で本番と同じ全項目（実測比較・構成照合・字幕照合・映像照合）をDB無しで実行。スモークと精度測定の共通部分。作業指示一覧はフォルダ直下CSV→ZIP内CSV→app_task.json の順に探す。job_xxx/package 形式の名前も扱う
- `scripts/video/variants.ts`（新規）: 見本から「ミスの種類が分かっている提出動画」を ffmpeg で生成。各変種に expectedFails（NGになるべき項目）と allowedExtra（出ても誤検知に数えない項目）を持たせる。既存5種に加え、低画質再エンコード／解像度854x480／音量-12dB／オープニング欠落／エンディング欠落／4秒の無音挿入／順番入れ替え／複合（セリフ抜け＋字幕ずれ）を追加。concat の継ぎ目で形式を揃えるため scale/fps/format と aformat で正規化
- `src/lib/video/inspection/accuracy.ts`（新規・テスト5件）: 項目別の 検出／誤検知／見逃し／職員確認(NGのはず・OKのはず) と、提出単位の差し戻し判定（差し戻すべき／正しく／誤って／見逃し）を集計し Markdown に描画
- `scripts/video/measure-inspection-accuracy.ts`（新規）: CLI。変種ごとの結果を scripts/output/accuracy/<pkg>/<variant>.json に保存し、再実行時は済んだ分を飛ばす（このPCはメモリ不足で長時間処理が止められるため）。1本の失敗で全体を止めず記録して続行。`--variants` `--force` `--report-only`
- smoke-structure-check.ts を共通モジュール利用に書き直し（`--cases voice_cut,telop_moved` のようにIDで絞る）
- 計測（新NISA、14本、合計約76分、2回に分けて実行）: 提出単位 差し戻すべき12／正しく12／誤って0／見逃し0。項目別も全項目で誤検知0・見逃し0・職員確認行き0。報告書を docs/提出後AI検品_精度測定_2026-09-22.md に保存
- 期待値側の修正: 「エンディングを落とす」は末尾7.43秒を切る作りだったが、新NISAの見本は最後のセリフが末尾まで続きエンディング区間が無く、セリフが切れて voice_present がNGになった（検出は正しい）。変種を「最後のセリフの後ろに2秒以上あるときだけ、その余白を落とす」に変更し、オープニング欠落も最初のセリフの前に余白があるときだけ作るようにした。新NISAではエンディング欠落は生成されない
- vitest 200件・tsc・eslint 通過
- 未実施: 他パッケージ（poc/scene/out/job_69577ea6=iDeCo、job_0837b376・job_bfcd66fb=相続税）での計測。`npx tsx scripts/video/measure-inspection-accuracy.ts poc/scene/out/job_69577ea6-edf5-4249-86a1-d1d26e906545/package` のように package フォルダを渡す
- e429871（段階5）を origin/main へ push → Vercel READY（19:00）

## 2026-09-22 夜：本番DBでの通し確認（提出→検品→自動差し戻し）と、そこで見つかった不具合の修正

- 本番の利用者「利用者 花子」（テストアカウント）の新NISA割当 aaed5b45 に、アプリの提出処理と同じ手順（Storage submissions/ へアップロード→submissions→割当 submitted→progress_logs→submission_inspections pending）をスクリプト（.tmp_read/e2e_submit*.mts）で実行し、この開発機で `inspect-worker.ts --job` を1回動かして確認
- v1（誤って手元の39本版から作った動画。本番の案件は29本の別レンダリング）: 検品は動いたが「職員の承認待ち」で自動差し戻しされなかった → **不具合発見**: 提出時のAI下書きが無い場合、applyInspectionResult が createAiReview で下書きを作り直すが、createAiReview は検品結果を DB の submission_inspections（status=completed）から読むため、まだ処理中のこの時点では結果が無視される。修正: createAiReview に `checkResult` オプションを追加し、applyInspectionResult から直接渡す。v1 の下書きを消して pending に戻し再処理 → 自動差し戻し4件（完成尺・セリフ29本不足・オープニング・エンディング）、割当 feedback
- v2（本番の完成見本と assets.zip を Storage から落とし scripts/output/prod-pkg-nisa に置き、variants の voice_cut で作成。提出時に createAiReview で下書きあり＝アプリの本来の経路）: 検品 29/29本・字幕28本・映像24か所 → 自動差し戻し2件（完成尺 214.2秒、S06_01 の入れ忘れ）、下書きに合流、割当 feedback。**通し確認成功**
- 本番のテスト提出 v1/v2 は残置（テストアカウントのため）。不要なら submissions/feedback/submission_inspections/progress_logs の行と Storage の2ファイルを消し、割当を in_progress に戻す
- iDeCo（job_69577ea6）の精度計測で字幕判定の弱点2つを発見・修正:
  - ①見本の側で長い字幕が「…」で省略表示される（S05_03）→ OCR が省略文を読み一致度79%で職員確認に。telopSimilarity に先頭一致ルール（正規化後12文字以上かつ長い方の50%以上が先頭一致なら同じ文）を追加
  - ②「はい。」のような短いセリフで、再エンコード後に真ん中の1枚が隣の字幕を読み「明らかに違う」→ 誤検知。telopCheck の撮り直し（30%・70%）を「文字なし」だけでなく「明らかに違う」にも適用
  - telop.test.ts に2件追加。vitest 61件(inspection)・tsc・eslint 通過。古いコードで走っていた iDeCo 計測は止め、`--force` で再計測中
- 気づき（未対応）: iDeCo の「オープニングを落とす」で frame_opening が unknown（類似度が 0.45〜0.75 の間）。完成尺で差し戻しはされるが、映像の判定としては見逃し寄り。再計測の数値を見て閾値を検討する

## 2026-09-22 深夜：iDeCo での精度計測と、短いセリフの扱いの見直し

- iDeCo（job_69577ea6、新形式・セリフ43本・見本288秒）で15本を `--force` で再計測（字幕判定修正後）。字幕の文の誤検知は消えた（再エンコード／解像度／音量の変種で NG なし）
- 新たに分かった弱点と対応:
  - 無音挿入・順番入替の変種で「はい。」（S09_02、約1秒）が音声指紋で見つからず「入れ忘れ」誤検知 → 加工の切れ目とは無関係で、短いセリフは再エンコードで見つけ損なうことがある。structure.ts に SHORT_VOICE_SEC=1.5 を導入し、1.5秒以下のセリフだけが見つからない場合は fail でなく unknown（職員確認）にした（テスト2件追加）。変種の切れ目も隣のセリフとの中間に変更
  - 新形式の見本は会話場面の見た目がほぼ同じで、場面差し替え後も類似度1.00（映像では見分けられない。字幕の文で検出）。オープニング／エンディング欠落も類似度0.63〜0.72で職員確認止まり。閾値を動かすと誤検知の危険があるので据え置き、既知の制約として報告書に明記
- 最終結果（2パッケージ＋本番見本、31本）: 差し戻し判定 26/26 正解、誤って差し戻し0、見逃し0。項目別の誤検知は全項目0。職員確認行きは 入れ忘れ2（短いセリフ）／オープニング1／エンディング2／場面2、場面の映像の見逃し1（差し戻し自体は字幕の文で成立）。報告書 docs/提出後AI検品_精度測定_2026-09-22.md を2パッケージ版に更新
- コミット: a05c544（自動差し戻し漏れ＋字幕判定2件）、efaed84（短いセリフ＋変種の切れ目＋計測の実測文保存）。未push
- 未計測: 相続税2件（job_0837b376・job_bfcd66fb）。同じコマンドで package フォルダを渡せば測れる
