# TTS ブラインドA/B テストキット

音声(ルーブリックM)の provider を「使えるから使う」でなく**実機ブラインド比較**で決めるためのキット。同一台本を各 provider で合成し、provider名を伏せて採点する。

> ⚠️ 実行すると各 provider に**課金**される（VOICEVOXを除く）。まず1〜2行で試すこと。鍵が無い provider は自動スキップ。

## 候補 provider（04の評価より）

| provider | 想定役割 | 鍵/前提 |
|----------|---------|--------|
| OpenAI gpt-4o-mini-tts | **ナレ第一候補**（JP自然度トップ級・instructions制御・安価） | `OPENAI_API_KEY` |
| ElevenLabs | **会話第一候補**（演技/感情最上位・voice固定） | `ELEVENLABS_API_KEY` ＋ `ELEVEN_VOICE_*` |
| Gemini 2.5 TTS | 候補（既存キー流用） | `GEMINI_API_KEY` |
| VOICEVOX | 低コスト/マスコット枠（無料・ローカル） | `VOICEVOX_URL`（起動時） |

## セットアップ

```bash
# 使う provider の鍵だけ設定すればよい（無いものはスキップ）
export OPENAI_API_KEY=sk-...
export ELEVENLABS_API_KEY=...
export ELEVEN_VOICE_NARR=<voice_id>       # ナレ用（日本語で良い声をElevenLabsのライブラリから選ぶ）
export ELEVEN_VOICE_HARU=<voice_id>        # ハル（初心者・20代男性）
export ELEVEN_VOICE_MINA=<voice_id>     # ミナ先生（20代後半〜30代前半女性）
export GEMINI_API_KEY=...
export VOICEVOX_URL=http://localhost:50021 # VOICEVOXエンジン起動時のみ

node poc/tts-ab/synth.mjs
```

## 出力

- `out/<lineId>__<provider>.(wav|mp3)` … 合成音声
- `out/eval.html` … **ブラインド評価シート**（provider名を伏せA/B/C…でランダム提示、7観点×1〜5点）
- `out/key.json` … 答え合わせ用（全採点後に開く）

## 評価観点（Mの下位項目）

自然さ / 間 / 抑揚 / 感情 / キャラ一貫 / 数字・強調 / 疲れにくさ（各1〜5）。
**優先順位**＝完成品質 > 自然な日本語 > 演技表現 > キャラ一貫性 > 同期 > API安定 > コスト > 速度（リアルタイムは不問）。

## 判定の目安

- **ナレ**：narr_hook_reveal（引き→結論）と narr_caution（注意）で、間・抑揚・数字の強調が自然か。gpt-4o-mini-tts が第一候補仮説。
- **会話**：conv_haru_question（ハル・驚き）と conv_mina_answer（ミナ先生・諭す）で、2声のキャラ差と感情が出るか。ElevenLabs が第一候補仮説。
- ナレと会話で別 provider を採用してよい（04の結論）。10分×本数で**コスト実測**も併記。

## 台本

`lines.json`（ナレ2本＋会話2ターン）。04 の音声表現パターン(§4)・冒頭絵コンテ(§6)から抽出。text は全 provider 共通、instructions/emotion は各アダプタが解釈。

## 注意

- 各 provider のAPI仕様（endpoint/body/voice名）は変わりうる。エラー時は公式docで確認して `synth.mjs` のアダプタを直す。
- ElevenLabs の voice_id は各自のアカウントのライブラリ/クローンから取得。日本語の訛りを必ず確認。
- 本キットは `poc/` 隔離。本番 `src`・`scripts`・DB は未変更。
