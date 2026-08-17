/**
 * テーマ → VideoProject（PROJECT→SCRIPT→SCENE[]）を生成する。再設計P0の中核。
 *
 * AiProvider(gemini/mock) と同思想で自己完結: GEMINI_API_KEY があれば Gemini で生成、
 * 無ければ/失敗すれば mock（決定的な新NISA相当の骨格）にフォールバックする。
 * 生成結果は必ず normalizeVideoProject を通してから返す（改ざん・欠損に耐える）。
 *
 * 設計の正: docs/redesign/04（§3 映像12種 / §4 音声9演技 / §5 7段構成 / §7 schema）。
 */

import {
  DELIVERY_STYLES, EMOTIONS, SECTIONS, VISUAL_TYPES,
  normalizeVideoProject, type VideoProject,
} from "./schema";

export interface GenerateVideoProjectInput {
  theme: string; // 例:「新NISAって結局何？」
  targetMinutes?: number; // 完成尺（分）既定10
  audience?: string; // 想定視聴者 既定「投資初心者」
  notes?: string[]; // 過去に見つかった不備・指摘（生成品質を上げるナレッジ）
}

export interface GenerateVideoProjectResult {
  project: VideoProject;
  provider: string; // gemini | mock | mock(fallback)
}

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function buildPrompt(input: GenerateVideoProjectInput): string {
  const minutes = input.targetMinutes ?? 10;
  const audience = input.audience ?? "投資初心者";
  const notes = (input.notes ?? []).map((n) => String(n).trim()).filter(Boolean);
  const notesBlock = notes.length
    ? `\n# 過去に見つかった不備・指摘（必ず守って生成する。同じ間違いを繰り返さない）\n${notes.map((n) => `- ${n}`).join("\n")}\n`
    : "";
  return `あなたは人気の金融解説YouTubeチャンネルの構成作家です。
テーマ「${input.theme}」で、約${minutes}分の完成動画の設計図を、シーン単位のJSONで出力してください。
視聴者は${audience}。専門用語には短い説明を添え、やさしい日本語で。

# このチャンネルの2人の固定ホスト（毎回登場する“チャンネルの顔”）
- **ミナ先生**(speaker=mina): やさしい女性の先生。解説役。視聴者の疑問にかみくだいて答える。
- **ハル**(speaker=haru): 好奇心旺盛な初心者の男の子。視聴者の代わりに素朴な疑問を出し、驚き、相づちを打つ。
- **narrator**: 数字の演出やタイトルなど“最小限のつなぎ”だけ。多用しない。

# 役割の固定（厳守・絶対に逆転させない）
- ハルは「わからない・気になる・すごい！」側。**質問・驚き・相づちだけ**。解説や答えを言わせない。
- ミナ先生は「教える」側。**解説・答え**を言う。初心者側のセリフを言わせない。
- 迷ったら「ハルが聞く→ミナ先生が答える→ハルが反応する」の順。

# 内容は“1本の芯”を通す（散漫にしない・ここが最重要）
- この動画で**いちばん伝えたい結論を1つ**決める（例:「新NISAは、利益に税金がかからないから、コツコツ長期で続けるほど得」）。
- ただし**結論は冒頭で言わない**。オープニングは“問い”を投げて引きつけるだけ（例:「新NISAって、結局そんなにお得なの？」）。
- 各シーンはその問いを一歩ずつ解いていき、**結論はエンディングで初めてはっきり伝えて回収する**（「最後まで見た人だけが分かる」構成）。
- 1シーン=1メッセージ。あれもこれも詰め込まない。枝葉の制度説明は削る。

# 掛け合いを主役にする
- **character_conversation を最頻の visual.type にする**（全体の半分以上）。ハルとミナ先生の会話で番組が進む。
- 各 character_conversation シーンは **audio を2〜4発話**（ハル→ミナ→ハル…の往復）。1往復で終わらせない。
- 図解(comparison/number_animation/process等)のシーンでも、ミナ先生の一言＋ハルの反応を audio に必ず入れる（図解を無言にしない）。

# 全体構成（この並びで作る。オープニングとエンディングを必ず入れる）
1. **オープニング(section=hook)**: タイトル的な一言のあと、**2人が視聴者に挨拶して自己紹介**（「こんにちは、ミナ先生です」「ハルです！」）、そして**今日の“問い”を提示して引きつける**（例:「新NISAって結局お得なの？ 最後まで見れば分かるよ」）。※結論はここでは言わない。
2. problem(問題提起・ハルの悩みから入る) → basics(基礎/ミナ先生が図解で解説) → example(数字の具体例/comparison・number) → dialogue(よくある誤解をハルが代弁→ミナ先生が正す) → caution(注意点)。各章末に「引き」で次への期待をつなぐ。
3. **エンディング(section=summary→cta)**: ここで**初めて結論をはっきり伝える**（ミナ先生が要点を1つにまとめ、ハルが「なるほど、そういうことか！」と腑に落ちる）。そのうえで最初の一歩(CTA)を提示。
各章末に次への「引き」を作り、3〜10秒ごとに視覚が変わるようにする。
シーン数は${minutes <= 3 ? "8〜12" : "12〜18"}程度に絞り、密度より“芯の通り”を優先する。

# 映像(visual.type)は次から選ぶ。金融の数字・比較・仕組みは必ず図解を使う:
${VISUAL_TYPES.join(" / ")}
- **できるだけ“図解で見せる”。character_explanation（立ち絵が話すだけ）は多用しない**。数字が出る場面は必ず number_animation か comparison、割合・推移は chart、仕組み・関係は infographic、手順は process、制度の変遷は timeline を使う。generated_video/broll は情緒・転換のみで最小限。
- 目安として、12〜18シーンなら図解系(comparison/number_animation/chart/infographic/process/timeline)を**5つ以上**入れる。
- comparison/number_animation/chart/timeline/process は infographic に構造化データを必ず入れる。
  comparison: {left,right,rows:[{label,leftValue,rightValue}],emphasis}
    ※ label・leftValue・rightValue は**短く**（数語・記号中心。例 label="年間の枠" leftValue="120万円" rightValue="360万円"、または "0円"）。文章にしない。長くても8文字程度まで。rowsは2〜3個。
  onScreenText(テロップ)も1項目**8文字程度まで**の短い語にする（文章にしない）。
  number_animation: {from,to,unit,format}
  chart: {chartKind:"bar|line|pie|area",series:[{label,points:[数値]}]}
  timeline: {points:[{year,label}]}
  process: {steps:[{title,detail}]}
- character_conversation は audio を2発話以上（haru と mina の掛け合い）。
- generated_video を使うなら imageToVideoPrompt を書く。数字の核をAI映像で埋めない。

# 音声(audio[])は発話の配列。ナレは1、会話は複数。各発話に演技情報を付ける:
speaker: narrator | mina | haru
text: 【最重要・必須】実際に声で読み上げる完全な一文。絶対に空にしない。これが無いと無音になる。
emotion: ${EMOTIONS.join(" / ")}
emotionIntensity: 1〜3
deliveryStyle: ${DELIVERY_STYLES.join(" / ")}
speakingRate: slow | normal | fast
emphasis: text の中で特に強調する語だけを抜き出した配列（textの言い換えや要約ではない。例 text="NISAなら、ゼロ円になるの。" のとき emphasis=["ゼロ円"]）
pauseBefore / pauseAfter: none | short | medium | long
syncTarget: 強調が結びつく画面/SEイベントID（任意、例 "sync:zero"）

発話の例:
{ "speaker": "narrator", "text": "毎月1万円。20年後、その差は、約171万円。", "emotion": "tension", "emotionIntensity": 3, "deliveryStyle": "hook_tension", "speakingRate": "slow", "emphasis": ["約171万円"], "pauseBefore": "none", "pauseAfter": "medium", "syncTarget": "sync:reveal" }

# 各シーンのフィールド
{
  "id": "scene_001",
  "section": ${SECTIONS.join("|")},
  "startSec": 数値, "endSec": 数値,
  "visual": { "type": ..., "description": "画面で何が起きるか(日本語)", "onScreenText": ["テロップ強調語"],
    "infographic": 上記の構造 or null, "imagePrompt": null, "imageToVideoPrompt": null,
    "cameraMotion": "none|push_in|pan", "transitionIn": "cut|slide|fade", "transitionOut": "cut|slide|fade" },
  "audio": [ { 上記の発話 } ],
  "bgm": { "track": null, "action": "continue|swell|duck|change" },
  "se": [ { "cue": "pop_positive", "at": "sync:zero" } ],
  "editingInstruction": "就労者向けの平易な作業指示",
  "requiredAsset": ["bg","narration.wav"],
  "qualityCheck": ["このシーンの合否観点"],
  "source": null または { "ref":"出典","confirmedDate":"YYYY-MM-DD","fiscalYear":"2026","needsCheck":true }
}

${notesBlock}
# 出力
次の形の有効なJSONのみを出力（前置き・コードフェンス禁止）:
{ "title": "動画タイトル", "theme": "${input.theme}", "audience": "${audience}", "goal": "この動画で理解させること", "targetMinutes": ${minutes}, "scenes": [ ...12〜24シーン... ] }`;
}

async function callGeminiJson(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API エラー (${res.status}): ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini API から空の応答");
  return text;
}

/** テーマから動画設計図を生成。Gemini→失敗/未設定でmockフォールバック。 */
export async function generateVideoProject(
  input: GenerateVideoProjectInput,
): Promise<GenerateVideoProjectResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { project: buildMockVideoProject(input), provider: "mock" };
  }
  try {
    const raw = await callGeminiJson(buildPrompt(input));
    const parsed = JSON.parse(raw);
    return { project: normalizeVideoProject(parsed, input.theme), provider: "gemini" };
  } catch (err) {
    console.error("Gemini SCENE生成に失敗。モックにフォールバックします:", err);
    return { project: buildMockVideoProject(input), provider: "mock(fallback)" };
  }
}

/** 決定的なモック（新NISA相当の7段骨格）。キー無し・テスト・オフラインで使う。 */
export function buildMockVideoProject(input: GenerateVideoProjectInput): VideoProject {
  const minutes = input.targetMinutes ?? 10;
  const raw = {
    title: input.theme,
    theme: input.theme,
    audience: input.audience ?? "投資初心者",
    goal: "NISAの仕組み・メリット・注意点を、初心者が自分ごととして理解する",
    targetMinutes: minutes,
    scenes: [
      {
        section: "hook", startSec: 0, endSec: 12,
        visual: {
          type: "number_animation", description: "暗い画面に1万円札が置かれ、20年後の差額がカウントアップ",
          onScreenText: ["毎月 ¥10,000", "+約171万円"],
          infographic: { from: 0, to: 1710000, unit: "円", format: "¥#,###" },
          cameraMotion: "push_in", transitionIn: "fade", transitionOut: "cut",
        },
        audio: [{
          speaker: "narrator", text: "毎月1万円。20年後、その差は、約171万円。",
          emotion: "tension", emotionIntensity: 3, deliveryStyle: "hook_tension",
          speakingRate: "slow", emphasis: ["約171万円"], pauseBefore: "none", pauseAfter: "medium",
          syncTarget: "sync:reveal",
        }],
        bgm: { track: null, action: "swell" },
        se: [{ cue: "confirm_impact", at: "sync:reveal" }],
        editingInstruction: "数字が出る瞬間に確定音を合わせる。差額は特大テロップで。",
        requiredAsset: ["bg", "narration.wav"],
        qualityCheck: ["フックで驚きの数字が出ているか"],
        source: { ref: "積立試算(年利想定)", confirmedDate: "2026-08-15", fiscalYear: "2026", needsCheck: true },
      },
      {
        section: "problem", startSec: 12, endSec: 20,
        visual: {
          type: "infographic", description: "『普通の投資』と『NISA』の入口の違いを2枠で示す",
          onScreenText: ["投資=こわい？"],
          infographic: null,
          cameraMotion: "none", transitionIn: "slide", transitionOut: "cut",
        },
        audio: [
          { speaker: "haru", text: "気になるけど、難しそうで手が出せなくて…", emotion: "puzzled", emotionIntensity: 2, deliveryStyle: "question_naive", speakingRate: "normal", emphasis: ["難しそう"], pauseBefore: "none", pauseAfter: "short", syncTarget: null },
          { speaker: "mina", text: "大丈夫。順番に見ていけば、ちゃんと分かるよ。", emotion: "calm_warm", emotionIntensity: 2, deliveryStyle: "explain_calm", speakingRate: "normal", emphasis: [], pauseBefore: "short", pauseAfter: "short", syncTarget: null },
        ],
        bgm: { track: null, action: "continue" },
        se: [],
        editingInstruction: "会話は話者を交互に強調（非話者は少し暗く）。",
        requiredAsset: ["haru_normal", "mina_normal"],
        qualityCheck: ["視聴者の不安を代弁できているか"],
        source: null,
      },
      {
        section: "basics", startSec: 20, endSec: 34,
        visual: {
          type: "infographic", description: "非課税のからくり（利益に税金がかからない）を図で",
          onScreenText: ["利益 → 税金ゼロ"],
          infographic: null,
          cameraMotion: "none", transitionIn: "cut", transitionOut: "cut",
        },
        audio: [{ speaker: "mina", text: "NISAは、投資で出た利益に税金がかからない仕組みなの。", emotion: "calm_warm", emotionIntensity: 2, deliveryStyle: "explain_calm", speakingRate: "slow", emphasis: ["税金がかからない"], pauseBefore: "none", pauseAfter: "medium", pronunciation: [{ word: "NISA", reading: "ニーサ" }], syncTarget: null }],
        bgm: { track: null, action: "continue" },
        se: [{ cue: "pop_light", at: "sync:tax" }],
        editingInstruction: "「税金ゼロ」でポップ音と要素出現を合わせる。",
        requiredAsset: ["infographic.svg", "narration.wav"],
        qualityCheck: ["非課税の意味が一目で分かるか"],
        source: { ref: "NISA制度概要", confirmedDate: "2026-08-15", fiscalYear: "2026", needsCheck: true },
      },
      {
        section: "example", startSec: 34, endSec: 44,
        visual: {
          type: "comparison", description: "通常口座 vs NISA。税金2万円 vs 0円を左右で比較、最後に差を強調",
          onScreenText: ["通常 2万円", "NISA 0円"],
          infographic: { left: "通常口座", right: "NISA", rows: [{ label: "利益10万への税金", leftValue: "約2万円", rightValue: "0円" }], emphasis: "0円" },
          cameraMotion: "none", transitionIn: "slide", transitionOut: "cut",
        },
        audio: [
          { speaker: "narrator", text: "通常なら約2万円の税金。NISAなら、ゼロ円。", emotion: "positive_surprise", emotionIntensity: 3, deliveryStyle: "reveal", speakingRate: "normal", emphasis: ["ゼロ円"], pauseBefore: "medium", pauseAfter: "short", syncTarget: "sync:zero" },
          { speaker: "haru", text: "まるまる残るんだ！", emotion: "realization", emotionIntensity: 3, deliveryStyle: "reaction", speakingRate: "fast", emphasis: [], pauseBefore: "short", pauseAfter: "none", syncTarget: null },
        ],
        bgm: { track: null, action: "swell" },
        se: [{ cue: "pop_positive", at: "sync:zero" }],
        editingInstruction: "「ゼロ円」で右側を0に、ポジティブSEを同期。",
        requiredAsset: ["infographic.svg", "narration.wav"],
        qualityCheck: ["差額が一目で伝わるか"],
        source: null,
      },
      {
        section: "dialogue", startSec: 44, endSec: 55,
        visual: {
          type: "character_conversation", description: "「絶対儲かる？」への誤解解消。話者交互強調",
          onScreenText: ["元本保証ではない"],
          infographic: null,
          cameraMotion: "none", transitionIn: "cut", transitionOut: "cut",
        },
        audio: [
          { speaker: "haru", text: "ミナ先生、NISAなら絶対に儲かるんですか！？", emotion: "surprise", emotionIntensity: 3, deliveryStyle: "question_naive", speakingRate: "fast", emphasis: ["絶対"], pauseBefore: "none", pauseAfter: "short", syncTarget: null },
          { speaker: "mina", text: "そこはね、かなり勘違いしやすいポイントなんだよ。", emotion: "gentle_warning", emotionIntensity: 2, deliveryStyle: "caution", speakingRate: "slow", emphasis: ["勘違いしやすい"], pauseBefore: "short", pauseAfter: "medium", syncTarget: null },
        ],
        bgm: { track: null, action: "duck" },
        se: [{ cue: "realize", at: "sync:point" }],
        editingInstruction: "掛け合いの「間」を大事に。テロップ「元本保証ではない」を出す。",
        requiredAsset: ["haru_surprised", "mina_normal"],
        qualityCheck: ["誤解が解ける流れになっているか"],
        source: null,
      },
      {
        section: "caution", startSec: 55, endSec: 66,
        visual: {
          type: "process", description: "始める前のチェック3つを順に点灯",
          onScreenText: ["生活防衛資金は残す"],
          infographic: { steps: [{ title: "余剰資金で", detail: "生活費とは分ける" }, { title: "長期で", detail: "短期売買に不向き" }, { title: "分散で", detail: "1つに集中しない" }] },
          cameraMotion: "none", transitionIn: "cut", transitionOut: "cut",
        },
        audio: [{ speaker: "mina", text: "始める前に、この3つだけ気をつけようね。", emotion: "serious", emotionIntensity: 2, deliveryStyle: "caution", speakingRate: "normal", emphasis: ["3つ"], pauseBefore: "none", pauseAfter: "short", syncTarget: null }],
        bgm: { track: null, action: "continue" },
        se: [{ cue: "check", at: "sync:step" }],
        editingInstruction: "各ステップ読み上げでチェック音と点灯を同期。",
        requiredAsset: ["infographic.svg", "narration.wav"],
        qualityCheck: ["注意点が3つに整理されているか"],
        source: null,
      },
      {
        section: "summary", startSec: 66, endSec: 76,
        visual: {
          type: "text_emphasis", description: "長期・積立・分散 の3語が1つずつドンと出る",
          onScreenText: ["長期", "積立", "分散"],
          infographic: null,
          cameraMotion: "none", transitionIn: "cut", transitionOut: "fade",
        },
        audio: [{ speaker: "narrator", text: "覚えるのは、長期・積立・分散。この3つ。", emotion: "bright_confident", emotionIntensity: 2, deliveryStyle: "summary_confident", speakingRate: "normal", emphasis: ["長期", "積立", "分散"], pauseBefore: "short", pauseAfter: "short", syncTarget: "sync:words" }],
        bgm: { track: null, action: "change" },
        se: [{ cue: "word_impact", at: "sync:words" }],
        editingInstruction: "3語を1語ずつ、各語にインパクト音。",
        requiredAsset: ["narration.wav"],
        qualityCheck: ["合言葉が記憶に残る出し方か"],
        source: null,
      },
      {
        section: "cta", startSec: 76, endSec: 86,
        visual: {
          type: "process", description: "口座開設3STEPを点灯。最初の一歩を示す",
          onScreenText: ["最初の一歩＝口座開設"],
          infographic: { steps: [{ title: "STEP1", detail: "ネットで申し込み" }, { title: "STEP2", detail: "本人確認" }, { title: "STEP3", detail: "積立を設定" }] },
          cameraMotion: "none", transitionIn: "slide", transitionOut: "fade",
        },
        audio: [{ speaker: "mina", text: "今日はじめれば、20年後のあなたが助かるよ。まずは口座開設から。", emotion: "encouraging", emotionIntensity: 3, deliveryStyle: "cta", speakingRate: "normal", emphasis: ["最初の一歩"], pauseBefore: "short", pauseAfter: "none", syncTarget: null }],
        bgm: { track: null, action: "swell" },
        se: [{ cue: "check", at: "sync:step" }],
        editingInstruction: "前向きなトーンで締める。CTAテロップを出す。",
        requiredAsset: ["infographic.svg", "narration.wav"],
        qualityCheck: ["行動の最初の一歩が明確か"],
        source: null,
      },
    ],
  };
  return normalizeVideoProject(raw, input.theme);
}
