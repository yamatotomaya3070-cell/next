# 04. 新NISA 完成動画設計 → SCENE schema 逆算（最新・正）

> DBから動画を考えない。まず VIDEO QUALITY RUBRIC A〜M で平均4.5以上を狙う10分動画をゼロから設計し、その動画を再現するために必要な映像・音声・編集表現を洗い出し、最後にSCENE schemaを逆算する。前回のNISAサンプル（02）は正解として固定しない。
>
> **本書の SCENE schema と完成動画設計を正とする。** 実装・DB・migration は未変更。

---

## 1. 更新版 VIDEO QUALITY RUBRIC A〜M

A〜L（03 で確定）に **M. 音声・演技品質** を正式追加。目標は **GPT Voice / ChatGPT Voice のような自然な会話感・間・抑揚・感情**。単に正しく読み上げるTTSでは3点止まり。

**合格ラインの更新**：公開品質＝全項目3以上・平均4.0以上。今回の目標は **A〜M 平均4.5**。視聴維持の三本柱 E・F・D に加え、**M（音声）を第4の柱**とする（金融教育系は「声が9割」、棒読みは内容が良くても離脱を生む）。**K（金融正確性）は安全ゲート**（1で公開不可）据え置き。

### M. 音声・演技品質
- **5**：人間のナレーター・声優にかなり近い。自然な間・文脈に応じた抑揚・自然な感情。キャラごとに声と話し方が一貫。疑問・驚き・注意・安心が声だけで分かる。重要な数字や単語を自然に強調。映像・テロップ・SEとタイミングが合う。10分聞いても「AI読み上げ感」の疲れが少ない。
- **3**：聞き取りやすく大きな違和感はないが、読み上げ感が残る。感情や間の表現が弱く、キャラクター性が薄い。
- **1**：棒読み・不自然な句読点・全文同じ速度／同じテンション。キャラ間の差が弱い。明確にAI音声だと感じ、公開動画品質に達していない。

> A〜L の定義は 03 §6 と同一。

## 2. 現行TTS方式の品質評価

優先順位＝**①完成音声品質 ②自然な日本語 ③演技表現 ④キャラ一貫性 ⑤映像同期 ⑥API安定 ⑦コスト ⑧生成速度**（リアルタイム性は不問）。既存3方式を「残す前提にせず」M基準(1〜5)で評価。

| 方式 | 日本語自然度 | 感情/演技 | 制御(抑揚/間/強調/話速) | キャラ固定 | 長文安定 | API/商用 | コスト | M点 | 役割判定 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|------|
| Windows SAPI (Haruka) | 低 | ほぼ無 | ピッチ変更のみ | 弱 | 可 | ローカルのみ | 無料 | **1** | 廃止（開発フォールバック専用） |
| VOICEVOX | 中〜中高 | 限定的 | speed/pitch/intonation可・強調弱 | 強(記号声) | 良 | 自己ホストHTTP | 無料/自前 | **2.5〜3** | 限定活用（マスコット声・低コスト枠） |
| Gemini 2.5 TTS | 中高 | 強("声優"寄り) | プロンプト指示・数値強調は間接 | 中 | 中(要分割) | 同一キー・商用可 | トークン課金 | **3.5〜4** | 候補（ステア性◎・既存キー流用） |
| **OpenAI gpt-4o-mini-tts** ★ | **高(JP自然度トップ級)** | 中高(instructionsで指示) | 指示で細かく制御可 | 中(10声・クローン無) | 中(4096字/req＝要分割) | 商用API・安価 | 低 | **4** | **ナレ第一候補** |
| **ElevenLabs v3** ★ | 高(一部voice訛りリスク) | **最高(audio tags)** | 強・表現力最上位 | 強(voice固定/クローン) | 良 | 商用API | 高め | **4.5** | **会話第一候補** |
| にじボイス / Typecast 等 | 高 | 高(アニメ/ドラマ調・多キャラ) | スタイル指定可 | 強 | 良 | 商用API | 中 | **4** | 会話の代替候補(JP声質重視) |
| Aivis / Style-Bert-VITS2(自己ホスト) | 中高 | 中高 | 抑揚制御可 | 強 | 良 | 自己ホスト | 低(運用費) | **3.5〜4** | 量産コスト枠(将来スケール) |

### 結論：ナレーションと会話で分離する

- **ナレーション＝OpenAI gpt-4o-mini-tts**（JP自然度トップ級・`instructions`で間/抑揚/強調を自然言語指示・安価で長文を分割生成）。感情の谷が深い山場だけ ElevenLabs に切替も可。
- **キャラクター会話＝ElevenLabs v3**（audio tagsで驚き・笑い・ため息、voice固定でキャラ一貫）。JP声質を最優先するなら にじボイス/Typecast を代替に。
- **VOICEVOX** は「マスコット記号としての声」を意図する場合や低コスト枠として限定活用、**SAPIは廃止**。
- 優先が完成品質（リアルタイム不問）なので、**バッチ生成（1文ずつ感情・間・強調を指定して合成→結合）**を前提にできる。

**確定前に必須の検証**：同一台本（ナレ20秒＋会話20秒）を各providerでブラインドA/B。特に ElevenLabs の日本語アクセント、gpt-4o-mini-tts のキャラ演技の限界、コスト実測（10分×本数）を実機で見る。

> 参考（2026年時点の日本語自然度スコア）：OpenAI gpt-4o-mini-tts ≈ 90.2 / Google Chirp3 HD ≈ 89.6 / ElevenLabs ≈ 89.0。数値は公開情報＋設計判断による暫定。

## 3. 必要な映像表現パターン（12種）

visual_typeを増やすことが目的ではない。「そのナレーションを最も理解しやすく、最も飽きずに見られる映像は何か」から逆算した結果の12種。比率は10分での目安。

| type | いつ使う | 伝えるもの | 動き | 音声同期 | テロップ / BGM・SE |
|------|---------|-----------|------|---------|-----------------|
| **comparison** (中核/最頻) | A vs B（貯金vs投資、課税vs非課税） | 2つの差を一目で | 左→右出現、差額を最後に特大 | 「NISAなら—ゼロ円」の"ゼロ円"で右0円 | 見出し＋強調数値／勝ち側ポジティブSE |
| **number_animation** (数字10-20%) | 金額・利回り・年数 | 数字のインパクト | 0→目標へカウントアップ、到達でドン | 読み速度とカウント一致、確定SE | 大数字／カウント音＋確定音 |
| **chart** (図解) | 推移・割合（複利・資産推移・税割合） | 量的関係・時間変化 | 棒/線/円が描画されていく | ピーク到達に強調語 | 軸・数値ラベル／描画スウォッシュ |
| **infographic** (図解) | 仕組み・関係（非課税のからくり・2枠） | 構造・つながり | 要素が順に出現し線でつなぐ | 各要素出現をナレ該当語に | 要素ラベル／出現ポップ |
| **character_conversation** (キャラ20-30%) | 疑問提示・誤解解消・視点転換 | 疑問代弁・退屈防止・テンポ | 話者交互強調(非話者減光)・表情・吹き出し | 2声の掛け合い・驚き/納得・間 | セリフ短句／ツッコミ・ひらめき音 |
| **character_explanation** (キャラ) | 概念導入・つなぎ・安心 | 語りかける安心感・関係づくり | 立ち絵の軽い揺れ・うなずき・口パク | 落ち着いた説明トーン・要所で間 | キーワードのみ／SE控えめ |
| **text_emphasis** (文字10-20%) | 結論・合言葉（長期・積立・分散） | 1つの言葉を記憶に刻む | 語が1つずつドン | 区切って強く発話、着地に文字 | 特大ワード／各語インパクト音 |
| **timeline** (図解) | 制度変遷（旧→新NISA 2024） | 時間的前後・節目 | 左→右スクロール、節目で停止 | 各節目でナレ年号に同期 | 年号ラベル／節目チック |
| **process** (図解) | やり方（口座開設3STEP） | 行動の順序 | STEP1→2→3点灯・チェック | 各ステップ読み上げに点灯 | STEP番号＋短文／確定音 |
| **recap** (文字) | 各章末・全体まとめ | 要点定着・区切り | 箇条が順に再掲・チェック | 確認トーンで区切る | 要点リスト／チェック音 |
| **generated_video** (AI映像10-20%/限定) | 感情・世界観・状況・注意リセット | 数字では出せない"空気" | 被写体/カメラの緩やかな動き(i2v) | ナレをかぶせBGM主役、転換 | 最小／雰囲気音 |
| **broll** (補助) | 現実の手触り（通帳・給料日） | 共感・具体のリアリティ | 実写のゆるいループ | ナレをかぶせる、長く映さない | 補足／環境音薄く |

**使い分けの原則**：金融の数字・比較・仕組みは図解(comparison/number/chart/infographic)が第一選択。generated_video と broll は情緒・状況・転換に限定。「NISAは非課税」に意味のない街のAI動画を当てない（ルーブリックEの核心）。

## 4. 必要な音声表現パターン（9種）

音声はSCENEの一部。ナレを「読む」でなく「演じる」ための演技型。これがそのまま音声フィールドの入力辞書になる。

| 演技パターン | 話者 | emotion | delivery / rate | emphasis・pause | 組む映像 |
|------|------|---------|----------------|----------------|---------|
| hook_tension（引き） | ナレ | curious / tension | ためて・やや遅め | 数字を強調／問いの後に間 | comparison, number |
| reveal（結論の提示） | ナレ | positive_surprise | 直前に間→一気に | 「ゼロ円」等強調／pause_before | comparison, number |
| explain_calm（基礎説明） | ミナ先生 | calm_warm | ゆっくり・丁寧 | 用語を強調／文末で軽い間 | infographic, character_explanation |
| question_naive（素朴な疑問） | ハル | curious / puzzled | 軽く・やや速め・語尾上げ | 疑問語を強調 | character_conversation |
| reaction（驚き・納得） | ハル | surprise / realization | 感情強め・短く | 感嘆に間→SE同期 | character_conversation |
| caution（注意） | ナレ/ミナ先生 | serious / gentle_warning | 少し遅く・低め | 「元本保証ではありません」強調／前に間 | text_emphasis, character_explanation |
| empathy（共感） | ナレ | warm / soft | 標準・語りかけ | 「あなた」を柔らかく | broll, generated_video |
| summary_confident（まとめ） | ナレ | bright_confident | 区切って明瞭 | 各キーワード強調 | text_emphasis, recap |
| cta（背中押し） | ミナ先生 | encouraging | 前向き・温かい | 「最初の一歩」強調 | process, character |

この辞書により、同じ文でも `delivery_style`／`emotion`／`emphasis`／`pause` が変わる。M(音声品質)5点は「文脈でこれが自動的に切り替わる」状態を指す。

## 5. 「新NISAって結局何？」10分完成動画設計

A〜M平均4.5を狙う設計。7区間で理解目標・映像・音声演技・BGM/SE/テロップ・引きを定義。**これが"作りたい動画"の正解であり、schemaはここから逆算する。**

| 区間 | 理解させること | 映像・図解・数字 | 音声演技・会話 | BGM / SE / テロップ / 引き |
|------|--------------|----------------|--------------|------------------------|
| **0:00–0:30** フック | 「自分に関係ある・続きが見たい」 | number＋comparison（1万円→20年後の差額）。§6で詳細 | ナレ hook_tension→reveal。末尾ハル surprise＋ミナ先生導入 | BGM静→上昇 / SEドラムロール＋確定 / テロップ特大数字 / 引き=「からくりを解説」 |
| **0:30–1:30** 問題提起 | 「投資こわい/難しそうで止まっている。NISAは何が違う?」 | broll(共感)→infographic("普通の投資"と"NISA"の入口の違い) | ナレ empathy。ハル「気になるけど難しそう…」ミナ先生「大丈夫、順番に」 | BGM柔らか / SE控えめ / テロップ悩みワード / 引き=「まず非課税の意味」 |
| **1:30–3:00** 基礎説明 | 「NISAは利益に税金がかからない。新NISAは枠拡大・恒久化・2枠」 | infographic(からくり)→chart(約20%課税の割合)→timeline(旧→新2024)→text(2枠) | ミナ先生 explain_calm、用語を丁寧に。ハルが要所で question_naive | BGM定常 / SE要素ポップ / テロップ用語＋読み仮名 / 引き=「実際いくら得?」 |
| **3:00–5:00** 数字の具体例 | 「利益10万で税金2万 vs 0円。積立20年でこう伸びる」 | comparison(通常口座 vs NISA、0円強調)→number_animation＋chart(積立20年) | ナレ reveal("ゼロ円"強調)。ハル reaction「まるまる残るんだ!」 | BGM高揚 / SE 0円ポジティブ＋カウント音 / テロップ大数字 / 引き=「でも絶対儲かる?」 |
| **5:00–7:00** 疑問と誤解 | 「元本保証ではない。価格変動リスクがある」 | character_conversation主体→generated_video(値動きの波で注意リセット)→chart(上下する値動き) | ハル「絶対儲かる?」ミナ先生 caution「勘違いポイント」。掛け合いの間が見せ場 | BGMやや落ち着き / SE ひらめき/注意音 / テロップ「元本保証ではない」 / 引き=「何に気をつける?」 |
| **7:00–9:00** 注意点 | 「短期売買に不向き・生活防衛資金は残す・非課税は利益が出れば」 | infographic(注意点3つ)→process(始める前チェック) | ミナ先生/ナレ caution、落ち着いて。ハルが不安を代弁 | BGM穏やか / SE チェック音 / テロップ注意3点 / 引き=「覚えるのは結局3つ」 |
| **9:00–10:00** まとめ＋CTA | 「長期・積立・分散。最初の一歩は口座開設」 | text_emphasis(3語を順に)→recap(要点再掲)→process(口座開設3STEP) | ナレ summary_confident(各語強調)→ミナ先生 cta「今日始めれば20年後のあなたが助かる」 | BGM前向き解決 / SE 各語インパクト＋チェック / テロップ合言葉＋CTA / 引き=関連動画・登録 |

**視聴維持の設計**：全区間で3〜10秒ごとに視覚変化、各章末に「引き」を必ず置く。図解:キャラ:AI映像:数字 ≒ 45:25:15:15。数字の核はすべて図解（AI映像で埋めない）。

## 6. 冒頭30秒 詳細絵コンテ

冒頭30秒は別格。3〜10秒単位で完成動画が想像できるレベルまで。※差額・税率は例示（実制作時はK項目で出典と確認）。

| 時間 | ナレ / 会話 | 映像 (visual_type) | テロップ | SE / 視覚変化 | sync |
|------|-----------|------------------|---------|--------------|------|
| **0:00–0:05** | 「毎月1万円。」*(hook_tension / 強調=1万円 / 直後に短い間)* | 暗い画面に1万円札がトンと置かれる (number_animation, push-in微速) | 「毎月 ¥10,000」 | コトッ(設置音) / 暗→ライト点灯 | "1万円"発話＝札の着地＝SE を同時 |
| **0:05–0:12** | 「銀行に置いた人と、NISAで積み立てた人。」*(やや速め / 強調=銀行・NISA)* | 左右2分割「銀行」寒色／「NISA」アクセント色がスライドイン (comparison) | 左「銀行」右「NISA」 | スライド音×2 / 2カラム確立 | "銀行"で左、"NISA"で右パネル出現 |
| **0:12–0:20** | 「20年後、その差は——」*(tension / 語尾を伸ばして"ため" / 直後に間0.6s)* | 差額がブラーで伏せられ、カメラ push-in (number_animation 準備) | 「20年後…?」 | ドラムロール上昇 / 緊張の高まり | "差は——"の伸ばしにドラムロールを重ねる |
| **0:20–0:25** | 「なんと、約○○万円。」*(reveal / positive_surprise / 直前pause→一気に / 強調=○○万円)* | 差額が0からカウントアップで特大表示 (number_animation) | 特大「+約○○万円」 | 確定ドン＋キラッ / 色が寒→暖(得) | カウント終了＝発話＝確定SE＝色変化 を同時 |
| **0:25–0:30** | ハル「え、そんなに変わるんですか!?」→ミナ先生「今日はその"からくり"を、世界一やさしく。」*(ハル=surprise / ミナ先生=calm_confident)* | ハル surprised 登場→ミナ先生→タイトルロゴ (character_conversation) | タイトル「新NISAって結局何？」 | ポップ登場音＋ロゴ着地音 / 本編へ | タイトル提示で本編0:30へ接続 |

**なぜ高得点か**：C(フック)=驚きの数字＋"ため"／E(一致)=全カットがナレ内容そのもの／M(音声)=hook→tension→revealの演技変化と間／I(SE)=ドラムロール→確定→ポップ／D(維持)=5秒ごとに視覚変化。**AI映像・立ち絵の埋め草はゼロ、全て意味のある画。**

## 7. SCENE schema 候補（完成動画から逆算）

上の完成動画を再現するのに**実際に使う情報だけ**を採る。前回23項目案を見直し、**音声を配列化**（会話は1シーンに複数発話）、不要フィールドを統合・削除、不足を追加。

```
# 1シーン = 3〜10秒。映像1レイヤー + 音声1〜複数発話 + 編集指示
Scene {
  id                 # scene_041
  section            # hook | problem | basics | example | dialogue | caution | summary | cta
  start_sec, end_sec # 暫定はAI推定 → 音声合成後に実尺で確定

  visual {
    type                   # 12パターンのenum（comparison / number_animation / chart / …）
    description            # 就労者・確認用の日本語（画面に何が起きるか）
    on_screen_text[]       # テロップ＝強調語（字幕とは別役割）※変更: 配列化
    infographic            # type別の構造化データ ※必要時のみ
                           #   comparison: {left,right,rows[],emphasis}
                           #   number_animation: {from,to,unit,format}
                           #   chart: {kind,series[]} / timeline: {points[]} / process: {steps[]}
    image_prompt           # generated_video / broll / 背景 の生成時のみ
    image_to_video_prompt  # generated_video時のみ（被写体/動き/カメラ/速度/禁止）※新規
    camera_motion          # push_in / pan / none ※新規・任意
    transition_in, transition_out  # slide / cut / fade ※新規・分離
  }

  audio[]  # ← narration単体を廃止し発話の配列に。会話は2要素
  {
    speaker            # character master参照: narrator | mina | haru
    text
    voice_id           # provider+voice（ナレ=gpt-4o-mini-tts / 会話=ElevenLabs 等・分離可）
    emotion            # §4辞書のenum: positive_surprise / calm_warm / caution / …
    emotion_intensity  # 1–3
    delivery_style     # §4の演技パターン名（reveal / explain_calm / …）
    speaking_rate      # slow | normal | fast（or 0.9–1.1）
    emphasis[]         # 強調する語（「ゼロ円」）
    pause_before, pause_after  # short | medium | long（ms）
    pronunciation      # 任意: NISA→「ニーサ」, 積立→「つみたて」等の読み固定
    sync_target        # この発話のemphasisが結びつく画面/SEイベントID
  }

  subtitle           # {source:"audio"} 音声から自動生成（テロップとは別レイヤー）
  bgm                # {track, action: continue | swell | duck | change} ※シーン別アクション
  se[]               # [{cue:"pop_positive", at:"sync:zero"}] ※新規・sync_targetで発話と接続
  editing_instruction  # 就労者向け平易文（package.tsが自動生成）
  required_asset[]     # bg/infographic.svg/narration.wav/se.wav …
  quality_check[]      # シーン別合否（ルーブリック項目に紐付け）
  source               # K項目: {ref, confirmed_date, fiscal_year, needs_check} 数値/制度シーンのみ
}
```

### 前回案からの変更

**追加（音声を設計対象に）**
- `audio[]`：発話の配列化（会話＝複数発話/シーン）
- `voice_id / emotion / emotion_intensity / delivery_style / speaking_rate / emphasis[] / pause_before/after / sync_target`：M項目を満たす演技情報
- `se[]＋sync_target`：SEを発話・画面イベントに同期（前回 audio_cue を統合）
- `infographic` 構造化・`image_to_video_prompt`・`camera_motion`・`transition_in/out`

**統合・削除（無意味に増やさない）**
- `narration`(単体) → `audio[]` に統合
- `dialogue` → `audio[]`（speakerで表現）に統合し廃止
- `character / character_expression` → `audio.speaker`＋`audio.emotion` から**表情を導出**（独立フィールド廃止。表情4種は emotion→expression マップで選択）
- `audio_cue` → `se[].at + sync_target` に統合
- 単発 `bgm/se` 文字列 → 構造化（action / cue+at）

**設計判断**：フィールドは「音声生成・レンダリング・就労者編集の**いずれかが実際に読む**もの」だけ採用。例：`sync_target`は3者すべてが使う（音声=強調位置／レンダ=SE・図解タイミング／就労者=「ここで効果音」の指示）ので中核。逆に`character_expression`は`emotion`から導けるので独立させない。

## 8. 現状アプリとの差分

| 要素 | 現状 | この設計に必要 | 扱い |
|------|------|--------------|------|
| 音声演技(emotion/emphasis/pause) | tts.tsは平読み、入力経路なし | audio[]の演技フィールド＋provider分離 | 新設＋差替 |
| TTS provider | Gemini/VOICEVOX/SAPI | ナレ=gpt-4o-mini-tts / 会話=ElevenLabs（要A/B） | 再選定 |
| comparison/number/chart/infographic 描画 | 皆無（静止テキストカードのみ） | SVG/動画で描画（金融の核） | 新規 |
| SE | フィールド・合成とも皆無 | se[]＋sync＋SEライブラリ | 新規 |
| キャラ表情 | normal/happy/surprised/thinking の4種あり | emotion→expression マップで選択 | 流用 |
| キャラ一貫性(seed)・スタイルガイド | 実装済み | character master参照の土台 | 流用 |
| ジョブ基盤・pipeline・見本レンダ | claim/lock・工程enum・ffmpeg | SCENEレンダのジョブ化に転用 | 流用 |
| 就労者UI(StepViewer/提出/チェック) | 実装済み・高完成度 | シーン単位カードに転用 | 流用 |
| i2v(generated_video) | smoke-klingのみ・未配線 | image_to_video_prompt→i2v配線 | 配線 |
| 字幕 | 音声実測から生成(video_jobs系) | subtitle=audio由来（テロップと分離） | 流用＋役割分離 |

## 9. P0 / P1 / P2 実装優先順位

音声(M)を第4の柱に格上げしたため、P0にTTS再選定と金融3図解を組み込む。「作りたい動画」を最短で見本品質まで出すことが基準。

### P0 — 見本品質の10分が成立する最小構成
- **SCENE schema 確定**（visual + audio[]）＝全機能の共通言語
- **音声providerの再選定＋演技入力配線**：ナレ=gpt-4o-mini-tts / 会話=ElevenLabs を A/Bで確定し、emotion/emphasis/pause/rate を渡す
- **金融3図解の描画**：comparison / number_animation / infographic（chartはP0後半）＝E・Fの核
- **section/PROJECT/SCRIPT 構造**（7段・フック）＝B・C・D
- **見本レンダ**：音声演技＋図解＋テロップ＋SE(最小)＋sync を焼いた完成見本（AIレビューと就労者の基準点）

### P1 — 公開品質へ引き上げ
- chart / timeline / process 描画、SEライブラリ＋sync拡充
- generated_video（i2v）配線（導入・情緒シーン限定）、camera_motion
- テンポ編集（カット・緩急・BGM同期）、字幕とテロップの役割分離
- 出典管理（source: ref/confirmed_date/fiscal_year）＝K項目
- practice系統合（作り込んだ系統をSCENEモデルに吸収しtasks接続）＋シーン単位の就労者カード

### P2 — 精度・自動化
- broll同期、口パク/簡易モーション、キャラ演技の高度化
- 内容ベース検品＝ルーブリックA〜Mの自動採点（AI採点が動画を見る破断②の解消）
- Aivis等の自己ホストTTSで量産コスト最適化、難易度別カリキュラム

### 次の一手（提案・未着手）
1. **TTS 3〜4 provider の実機A/Bブラインドテスト**（同一台本20秒）で音声を確定
2. **comparison/number/infographic のレンダPoC**（scene_041相当を1本だけ実描画）で図解の実現可能性を潰す

ここまでは migration も大規模実装も不要。

---

*TTSスコアは公開情報（2026年時点）＋設計判断による暫定で、provider確定は実機ブラインドA/Bを要する。冒頭30秒の差額・税率等は例示で、実制作時はK項目の出典管理で一次情報と確認日を紐付ける。*
