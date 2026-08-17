# poc/ — 再設計の検証用PoC（本番非依存）

`docs/redesign/` の設計を、着手前に**最小リスクで実機検証**するための隔離フォルダ。
**`src/`・`scripts/`・DB・migration には一切触れない。** 依存は既存の `sharp` / `ffmpeg` のみ。

## 1. infographic/ — 図解レンダPoC ✅ 実施済み

P0最大の未知数「金融図解を構造化データから描けるか」を検証。
`SCENE.visual.infographic`(JSON) → SVG生成(汎用) → `sharp`でPNG → `ffmpeg`でmp4 という本番想定経路をそのまま実行。

```bash
node poc/infographic/render.mjs        # out/reel.mp4 と各scene_*_still.png を生成
node poc/infographic/build_artifact.mjs out.html   # 閲覧用HTML(mp4/静止画埋め込み)を生成
```

**結果**：**5 visual_type を公開品質で実描画**（30秒/1280×720/30fps/約0.74MB）。日本語グリフのラスタライズOK。
- `comparison`(scene_041 通常口座 vs NISA・税金0円強調)
- `number_animation`(scene_002 カウントアップ・幅自動フィット)
- `chart`(scene_046 積立20年の資産推移・元本 vs 運用5%複利)
- `timeline`(scene_024 NISA制度変遷・2024強調)
- `process`(scene_070 口座開設3ステップ)

→ 図解レンダは**新基盤不要、既存経路に「SVG生成層」を足すだけ**で成立、と確認。

- `shared.mjs` … デザイントークン＋イージング＋SVGヘルパ
- `comparison/number/chart/timeline/process.mjs` … visual_type別の生成器（データ駆動）
- `scenes.mjs` … SCENEデータ（AIが生成する設計図の入力に相当）
- `render.mjs` … SVG→PNG→mp4 オーケストレータ（5シーンをreel.mp4に連結）
- `build_artifact.mjs` … 実mp4＋静止画＋入力JSONを埋め込んだ閲覧HTMLを生成
- `out/` … reel.mp4・scene_*.mp4・scene_*_still.png（中間フレームは掃除済み）

次に潰す未知数：SEのsync、立ち絵・背景・字幕との合成、AI出力JSONの妥当性。

## 2. tts-ab/ — TTSブラインドA/Bキット ⏳ 実行待ち（要APIキー・課金）

音声(ルーブリックM)の provider を実機ブラインド比較で決めるキット。
同一台本(ナレ2＋会話2)を各providerで合成し、provider名を伏せて7観点採点。

```bash
# 使うproviderの鍵だけ設定（README参照）→
node poc/tts-ab/synth.mjs   # out/eval.html(ブラインド評価) と key.json を生成
```

仮説：ナレ=OpenAI gpt-4o-mini-tts / 会話=ElevenLabs（04の評価）。実機で確定する。
※ 課金が発生するため未実行。鍵と少額予算の用意後に走らせる。

## 位置づけ

これらは「作りたい動画」(`docs/redesign/04`)の実現可能性を潰すための使い捨てPoC。
確定後、生成器のロジックは本番の図解レンダ層・音声合成層へ移植する。
