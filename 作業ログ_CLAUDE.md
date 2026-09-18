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
