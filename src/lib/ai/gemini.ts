import type {
  AiProvider,
  GenerateCaseGuideInput,
  GeneratedCaseGuide,
  GeneratePracticeScriptInput,
  GeneratedPracticeScriptResult,
  GenerateSimilarCaseInput,
  GenerateSourceScriptInput,
  GenerateTaskInput,
  GeneratedSimilarCase,
  GeneratedSourceScript,
  GeneratedTask,
  GradeResult,
  GradeSubmissionInput,
  MaskingReport,
  ProposeStyleGuidesInput,
  StyleGuideProposal,
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeStyleGuide } from "@/lib/style-guide/schema";
import { normalizePracticeScript } from "@/lib/practice-script/schema";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** AI利用ログの用途区分（コスト集計の内訳に使う） */
type AiUsageKind =
  | "task"
  | "similar_case"
  | "mask"
  | "source_script"
  | "grade"
  | "case_guide"
  | "style_guide"
  | "practice_script";

/**
 * Gemini のトークン使用量を ai_usage_logs へ記録する（コスト可視化用）。
 * サービスロールでの書き込み。テーブル未適用・env未設定でも生成をブロックしない
 * よう、失敗はすべて握りつぶす。migration 00009_ai_usage_logs.sql が対応。
 */
async function logAiUsage(
  model: string,
  kind: AiUsageKind,
  usageMetadata: unknown,
): Promise<void> {
  try {
    const u = (usageMetadata ?? {}) as {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
    const admin = createAdminClient();
    await admin.from("ai_usage_logs").insert({
      provider: "gemini",
      model,
      kind,
      prompt_tokens: u.promptTokenCount ?? null,
      output_tokens: u.candidatesTokenCount ?? null,
      total_tokens: u.totalTokenCount ?? null,
    });
  } catch (err) {
    console.error("AI利用ログの記録に失敗（生成は継続）:", err);
  }
}

async function callGemini(
  prompt: string,
  kind: AiUsageKind,
  temperature = 0.7,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini API から空の応答が返されました");
  await logAiUsage(model, kind, data?.usageMetadata);
  return text;
}

const COMMON_STYLE = `
出力の文章スタイル（重要）:
- 障害者就労支援施設の、動画編集が未経験の利用者向けです。
- 一文は短く。平易な日本語。専門用語には説明を添える。むずかしい漢字はできるだけ避け、やさしい言い回しにする。
- ふりがなは付けない。「漢字《かんじ》」のような《》を使った読みがな記法は絶対に使わない。
- 否定的・威圧的な表現は使わない。励ます表現を使う。
- 必ず有効なJSONのみを出力する。`;

/**
 * requestDoc（依頼書＝依頼文＋案件仕様書）の書き方ガイド。
 * クラウドワークスの実案件と同等の情報量・具体性を担保しつつ、どんなジャンルにも同じ枠組みで
 * 対応できる「汎用の実務仕様書」にする。表示側は Markdown を解釈せず生テキスト（whitespace-pre-wrap）
 * で出すため、見出しは # を使わず【】で示し、そのまま読んで綺麗に見える書式にする。
 * 仕様を独立テーブルにせず requestDoc に構造化して埋め込むことで、既存の表示のまま質を上げる。
 */
const REQUEST_DOC_GUIDANCE = `
requestDoc は「クライアントから届いた依頼文」と「案件仕様書」を1つにまとめた"生テキスト"にする。
表示はMarkdownを解釈しないので # や ## や表は使わない。見出しは【】、箇条書きは・を使う。

書式の骨組み（この順・この見出しを必ず守る。どのジャンルでも同じ枠組みで、中身を具体化する）:

━━━━━━━━━━━━
依頼文
━━━━━━━━━━━━
クライアントからの自然なメッセージ。あいさつ→作ってほしい動画→目的→見る人→載せる場所→
雰囲気の希望→参考イメージ→納期感、の流れ。実在の企業名・商品名・URL・連絡先は出さず
「あるお店」「ある商品」等にする。

━━━━━━━━━━━━
案件仕様書
━━━━━━━━━━━━

【1. この動画について】
・目的 ／ 見る人（ターゲット） ／ 載せる場所（YouTube・TikTok・店頭・社内 など） ／ ジャンル ／ 雰囲気

【2. 納品するもの（動画の仕様）】  ※ここは必ず具体的な数値で書く。曖昧語（「ちょうどいい長さ」等）は禁止
・長さ：◯秒（許容の幅も。例「60秒 ±5秒まで」）
・画面比率：16:9・9:16・1:1 のいずれか（横長／縦長／正方形の別も添える）
・解像度：例 1920×1080 のように幅×高さで
・fps：例 30fps
・ファイル形式：例 MP4（H.264）
・ファイル名ルール：必ず例を1つ示す（例「shohin_太郎.mp4」）

【3. 使う素材】  ※実案件との差が出やすい所。何が渡されて何を自分で用意するかを分ける
・支給される素材：（渡す動画・写真・ロゴ・音声 など）
・自分で用意する素材：（BGM・効果音・Bロール・画像・フォント など。商用利用OKの無料素材を使う旨と入手先の種類を書く）
・無い場合はどちらも「なし」と明記する（空欄にしない）

【4. 編集のルール】  ※作業できる粒度で。数値や目安を入れる
・テロップ：入れる/入れない、文字の大きさの目安、位置、色、表示のタイミング・長さ
・カットとテンポ：残す/削る基準、目安のテンポ（例「1分あたり8〜12カット」）
・音の大きさ：声とBGMのバランス、うるさすぎ/小さすぎを避ける目安
・BGM・効果音：雰囲気、入れる場所
・はじめと終わり：オープニング/エンディングやロゴ・締めの有無
・場面の切り替え：トランジションの種類や使いどころ（使わないなら「使わない」）

【5. やること・やらないこと（作業範囲）】
・やること：この案件で行う作業を箇条書き
・やらないこと：今回はしなくてよいこと（サムネイル制作、素材の撮影 など）を明記して範囲を絞る

【6. 参考】
・参考にする動画やイメージを"言葉で"説明（URLは書かない。構成・雰囲気・良い例/避けたい例）

【7. 納品】
・納期（何日以内か） ／ 提出方法 ／ 再提出・修正の想定

【8. 確認したいこと】
・依頼に書かれておらず曖昧で、本来クライアントに確認すべき点を2〜4個。
  （就労者が「わからないことを相談する」練習になる。空にしない）

値の決め方:
- 練習案件（新規生成）では、ジャンルに合った現実的な具体値を"決めて"埋める。
- 実案件の整形時は、依頼文に書かれた値をそのまま使い、書かれていない項目は勝手に決めず【8. 確認したいこと】に回す。
- ジャンルは限定しない（解説・商品紹介・Vlog・インタビュー・切り抜き・SNS広告・イベント記録・研修 など何でも、上の枠組みで具体化する）。
- 難易度が低いほど各項目を具体的・親切にし曖昧さを減らす。高いほど指示を簡素にし【8】を増やして構成や表現の判断を就労者に委ねる。

一貫性（重要）: 【2】の数値・【4】のルールは、manualSteps（手順書）と selfCheckItems（納品前チェック）に
必ず対応させ、三者で矛盾させないこと。`;

/** manualSteps（手順書）の書き方ガイド。仕様書の値に沿った実際の作業順にする。 */
const MANUAL_GUIDANCE = `
manualSteps は上の仕様書に沿った実際の編集作業順にする:
依頼書と仕様を読む → 素材の確認（足りない素材は【3】に従って自分で探す）→ 全体の構成を考える →
カット → テロップ → BGM・効果音 → 音量の調整 → 仕様どおりか見直し → 指定の形式・ファイル名で書き出し → 提出。
1ステップ=1操作で細かく分ける。仕様書【2】の数値（尺・比率・解像度・形式・ファイル名）を満たしているか
確認してから書き出すステップを必ず入れる。難易度が高いほど各ステップの指示は簡素にし、判断を就労者に任せる。`;

/** ステップ1の出力: 実案件の構造化 + 匿名化 */
interface MaskedCaseStructure {
  maskedCaseText: string;
  genre: string;
  skillTags: string[];
  difficulty: number;
  cautionPoints: string[];
  maskingReport: MaskingReport;
}

/**
 * ステップ1: 実案件テキストを匿名化・構造化する。
 * 創作を避けるため低temperatureで実行し、以降のステップには匿名化済みテキストのみを渡す。
 */
async function maskAndStructureCase(rawCaseText: string): Promise<MaskedCaseStructure> {
  const prompt = `あなたは個人情報保護の担当者です。以下のクラウドソーシングの動画編集案件の依頼文を、練習教材の元ネタとして安全に使えるよう匿名化・構造化してください。

依頼文（原文）:
"""
${rawCaseText}
"""

匿名化のルール（厳守）:
- 企業名・サービス名・商品名・個人名 → 「依頼者」「あるお店」「ある商品」など一般名詞に置換
- URL・メールアドレス・電話番号・SNSアカウント → 削除
- チャンネル名・動画タイトルなど特定につながる固有名詞 → 一般化
- 報酬額・契約条件・NDAに関わる記載 → 削除
- 依頼内容の本質（作業内容・完成尺・納品形式・テロップルール・修正条件）は変えない
- 判断に迷った箇所は削除した上で riskNotes に記録する

出力するもの:
1. maskedCaseText: 匿名化済みの依頼内容の要約（作業内容・尺・形式・ルールを漏らさず）
2. genre: 案件ジャンル。'vlog' | 'ad' | 'subtitle' | 'clip' | 'interview' | 'other' のいずれか
3. skillTags: 必要スキル。'cut','telop','bgm','volume','image','color','duration','export','revision','brief' から該当するもの
4. difficulty: 未経験者から見た難易度 1〜5
5. cautionPoints: この案件で特に注意すべき点（依頼者のこだわり・修正になりやすい点・納品条件の落とし穴など、3〜6個。固有名詞を含めない）
6. maskingReport: { "removedItems": ["何をどう置換/削除したか"], "riskNotes": ["職員が確認すべき残存リスク"] }

必ず有効なJSONのみを出力する。

JSONスキーマ:
{
  "maskedCaseText": "string",
  "genre": "string",
  "skillTags": ["string"],
  "difficulty": number,
  "cautionPoints": ["string"],
  "maskingReport": { "removedItems": ["string"], "riskNotes": ["string"] }
}`;

  const json = await callGemini(prompt, "mask", 0.2);
  const parsed = JSON.parse(json) as MaskedCaseStructure;
  if (!parsed.maskedCaseText || !parsed.maskingReport) {
    throw new Error("Gemini の匿名化応答が期待した形式ではありません");
  }
  if (!Array.isArray(parsed.cautionPoints)) parsed.cautionPoints = [];
  return parsed;
}

export const geminiProvider: AiProvider = {
  name: "gemini",

  async proposeStyleGuides(input: ProposeStyleGuidesInput): Promise<StyleGuideProposal> {
    const count = input.count && input.count >= 1 && input.count <= 5 ? Math.floor(input.count) : 3;
    const charCount =
      input.characterCount && input.characterCount >= 1 && input.characterCount <= 4
        ? Math.floor(input.characterCount)
        : 2;

    const prompt = `あなたは動画チャンネルのアートディレクターです。
「1人のYouTuberが長期的に運営する架空のチャンネル」のスタイルガイドを ${count} 案、それぞれ雰囲気を変えて提案してください。
このガイドは以降の全動画（アニメ調の立ち絵＋背景＋ナレーション＋テロップ）で固定して使い回します。

チャンネルの方向性（管理者の希望。空なら自由に魅力的な案を作る）:
${input.brief || "（指定なし。初心者にやさしい、親しみやすい解説チャンネルを想定）"}

重要な制約:
- 既存のYouTubeチャンネル・アニメ・キャラクターの模倣は厳禁。台本/キャラデザ/配色/テロップ装飾/サムネ構図はすべて独自にする。
- 各案は登場キャラを ${charCount} 体にする。キャラには一貫した役割（進行役/解説役など）を持たせる。
- パレットの色はすべて #RRGGBB 形式のHEX。
- 「client」は担当YouTuber（常連クライアント）の人物像。毎回の依頼メッセージをこの人格で書ける具体性を持たせる。
- 日本語で、就労支援施設の初心者にも伝わる平易な言葉で書く。

各案は次のJSON構造にする:
{
  "name": "string（このチャンネル/ガイドの名前）",
  "artStyle": "string（画風の説明。画像生成の基調）",
  "negativeStyle": "string（避ける要素・崩れ・模倣回避）",
  "client": {
    "channelName": "string",
    "clientName": "string（依頼主の呼び名）",
    "persona": "string（依頼主の人物像・依頼の口調）",
    "audience": "string（主な視聴者層）"
  },
  "palette": { "background": "#RRGGBB", "primary": "#RRGGBB", "accent": "#RRGGBB", "telopOutline": "#RRGGBB" },
  "characters": [
    { "key": "英数字の識別子", "name": "string", "role": "string", "appearance": "string（独自デザインの見た目）", "voiceProfile": "speaker_a など", "seed": 1234, "subtitleColor": "#RRGGBB" }
  ],
  "telopRules": { "fontMood": "string", "outline": "string", "position": "string", "decoration": "string" },
  "thumbnail": "string（サムネ構図ルール）",
  "seriesVoice": "string（シリーズのトーン・世界観）"
}

出力は次のJSONのみ:
{ "guides": [ 上のオブジェクトを ${count} 個 ] }`;

    const json = await callGemini(prompt, "style_guide", 0.9);
    const parsed = JSON.parse(json) as { guides?: unknown };
    const rawGuides = Array.isArray(parsed.guides) ? parsed.guides : [];
    if (rawGuides.length === 0) throw new Error("Gemini の応答にスタイルガイド案が含まれていません");
    return { guides: rawGuides.slice(0, count).map((g) => normalizeStyleGuide(g)) };
  },

  async generateTask(input: GenerateTaskInput): Promise<GeneratedTask> {
    const knowledgeBlock = input.knowledgeContext
      ? `
これまでに取り込んだ実案件のナレッジ（参考）:
${input.knowledgeContext}
上記の実案件の傾向（依頼の書き方・要求水準・注意されやすい点）を模擬依頼書とチェックリストに反映し、より本番に近い練習案件にしてください。`
      : "";
    const editingPatternBlock = input.editingPatternContext ? `\n\n${input.editingPatternContext}` : "";

    const prompt = `あなたはクラウドワークス等の動画編集実案件を熟知したディレクター兼講師です。実案件と同等の情報量・具体性をもつ練習課題一式を生成してください。

条件:
- テーマ: ${input.theme}
- ジャンル: ${input.genre ?? "テーマから最も自然なジャンルを推定する"}
- 難易度: ${input.difficulty} (1=いちばん簡単, 5=実務レベル)
- 練習するスキル: ${input.skillTags.join(", ")}
${input.traineeNote ? `- 利用者への配慮メモ: ${input.traineeNote}` : ""}${knowledgeBlock}${editingPatternBlock}

生成するもの:
1. requestDoc: 下記ガイドに従った「依頼文＋案件仕様書」（生テキスト・#やMarkdownは使わない）
${REQUEST_DOC_GUIDANCE}
2. manualSteps: 操作手順書（5〜12ステップ）。各ステップに text（やること）と tip（コツや励まし、なければnull）
${MANUAL_GUIDANCE}
3. script: 字幕・テロップ用の台本（テロップ課題でなければ null）
4. selfCheckItems: 納品前セルフチェック項目（4〜6個）。仕様書【2】の数値・【4】のルールと1対1で対応させる
${COMMON_STYLE}

JSONスキーマ:
{
  "title": "string（【練習】で始める）",
  "summary": "string（1〜2文の平易な説明）",
  "estimatedMinutes": number,
  "dueInDays": number,
  "requestDoc": "string",
  "manualSteps": [{"text": "string", "tip": "string|null"}],
  "script": "string|null",
  "selfCheckItems": ["string"]
}`;

    const json = await callGemini(prompt, "task");
    const parsed = JSON.parse(json) as GeneratedTask;
    if (!parsed.title || !parsed.requestDoc || !Array.isArray(parsed.manualSteps)) {
      throw new Error("Gemini の応答が期待した形式ではありません");
    }
    return parsed;
  },

  async generateCaseGuide(input: GenerateCaseGuideInput): Promise<GeneratedCaseGuide> {
    // 実案件そのものを配布するためのガイド生成。案件内容は変えず、
    // 就労者が読みやすい依頼書＋この案件のやり方（手順書）＋チェックリストを用意する。
    const prompt = `あなたはクラウドワークス等の動画編集案件を熟知したディレクター兼、就労支援施設の講師です。
以下は実際に受注した動画編集案件の依頼文です。これを施設の利用者（動画編集が未経験の方）が実際にこなせるよう、配布用の資料を作ってください。
重要: 案件の内容・要求（作業内容・尺・形式・テロップ等のルール・納期）は変えないこと。別の案件を作ってはいけません。読みやすく整えるだけです。

実案件の依頼文:
"""
${input.caseText}
"""
${input.traineeNote ? `\n利用者への配慮メモ: ${input.traineeNote}\n` : ""}
作るもの:
1. readableRequestDoc: 上の依頼文を、利用者向けに読みやすく整えた依頼書（生テキスト・#やMarkdownは使わない）。
   ${REQUEST_DOC_GUIDANCE}
   ただし今回は「実案件を整形する」ことが目的。依頼文に書かれた要求は忠実に残し、書かれていない仕様は【8. 確認したいこと】に回す（勝手に創作しない）。
   実在の企業名・個人名・連絡先・URLが依頼文に含まれる場合は「あるお店」「依頼者」等に置き換える。
2. manualSteps: この案件をこなすための操作手順書（5〜12ステップ）。各ステップに text と tip（コツや励まし、なければnull）。
   ${MANUAL_GUIDANCE}
3. selfCheckItems: 納品前セルフチェック項目（4〜6個）。依頼の指定（尺・比率・形式・テロップ・BGM等）と対応させる。
4. title: この案件のタイトル（実案件の内容を表す短い名前。「【練習】」は付けない）。
5. summary: 1〜2文の平易な説明。
6. skillTags: 使うスキル。'cut','telop','bgm','volume','image','color','duration','export','revision','brief' から該当するもの。
7. difficulty: 未経験者から見た難易度 1〜5。
8. estimatedMinutes: 想定作業時間（分）。
${COMMON_STYLE}

JSONスキーマ:
{
  "title": "string",
  "summary": "string",
  "skillTags": ["string"],
  "difficulty": number,
  "estimatedMinutes": number,
  "readableRequestDoc": "string",
  "manualSteps": [{"text": "string", "tip": "string|null"}],
  "selfCheckItems": ["string"]
}`;

    const json = await callGemini(prompt, "case_guide");
    const parsed = JSON.parse(json) as GeneratedCaseGuide;
    if (!parsed.title || !parsed.readableRequestDoc || !Array.isArray(parsed.manualSteps)) {
      throw new Error("Gemini の応答が期待した形式ではありません");
    }
    if (!Array.isArray(parsed.skillTags)) parsed.skillTags = [];
    if (!Array.isArray(parsed.selfCheckItems)) parsed.selfCheckItems = [];
    if (!parsed.difficulty) parsed.difficulty = 3;
    if (!parsed.estimatedMinutes) parsed.estimatedMinutes = 60;
    return parsed;
  },

  async generateSimilarCase(
    input: GenerateSimilarCaseInput,
  ): Promise<GeneratedSimilarCase> {
    // ステップ1: 匿名化・構造化（原文はここまで。以降は匿名化済みテキストのみ使用）
    const masked = await maskAndStructureCase(input.rawCaseText);
    const difficulty = input.difficulty ?? masked.difficulty;

    const references =
      input.referenceSnippets && input.referenceSnippets.length > 0
        ? `\n過去の類似案件（匿名化済み・参考）:\n${input.referenceSnippets
            .map((s, i) => `${i + 1}. ${s}`)
            .join("\n")}\n参考例の依頼の書き方・要求水準に寄せると、より本番に近くなります。`
        : "";
    const editingPatternBlock = input.editingPatternContext ? `\n\n${input.editingPatternContext}` : "";

    // ステップ2: 模擬案件一式の生成
    const prompt = `あなたはクラウドワークス等の動画編集実案件を熟知したディレクター兼講師です。以下の「匿名化済みの実案件」に似た練習案件一式を、実案件と同等の情報量・具体性で生成してください。実案件そのもののコピーではなく、同じジャンル・同じ要求水準の「類似案件」を新しく作ります。

匿名化済みの実案件:
"""
${masked.maskedCaseText}
"""
- ジャンル: ${masked.genre}
- 練習するスキル: ${masked.skillTags.join(", ")}
- 難易度: ${difficulty} (1=いちばん簡単, 5=実務レベル)
${input.traineeNote ? `- 利用者への配慮メモ: ${input.traineeNote}` : ""}${references}${editingPatternBlock}

生成するもの:
1. requestDoc: 下記ガイドに従った「依頼文＋案件仕様書」（生テキスト・#やMarkdownは使わない）。実案件と同じ種類の要求水準を保つ
${REQUEST_DOC_GUIDANCE}
2. manualSteps: 操作手順書（5〜12ステップ）。各ステップに text（やること）と tip（コツや励まし、なければnull）
${MANUAL_GUIDANCE}
3. script: 字幕・テロップ用の台本（テロップ課題でなければ null）
4. selfCheckItems: 納品前セルフチェック項目（4〜6個）。仕様書【2】の数値・【4】のルールと1対1で対応させる
5. revisionNote: 初回納品後に依頼者から届く想定の修正指示文（依頼者口調のメッセージ。2〜3箇所の具体的な修正。実案件で起こりがちな修正内容にする）
6. sampleDescription: 完成見本の説明（何がどうなっていれば合格か。職員の採点にも使う）
${COMMON_STYLE}

JSONスキーマ:
{
  "title": "string（【練習】で始める）",
  "summary": "string（1〜2文の平易な説明）",
  "estimatedMinutes": number,
  "dueInDays": number,
  "requestDoc": "string",
  "manualSteps": [{"text": "string", "tip": "string|null"}],
  "script": "string|null",
  "selfCheckItems": ["string"],
  "revisionNote": "string",
  "sampleDescription": "string"
}`;

    const json = await callGemini(prompt, "similar_case");
    const parsed = JSON.parse(json) as GeneratedSimilarCase;
    if (!parsed.title || !parsed.requestDoc || !Array.isArray(parsed.manualSteps)) {
      throw new Error("Gemini の模擬案件応答が期待した形式ではありません");
    }
    if (!parsed.revisionNote || !parsed.sampleDescription) {
      throw new Error("Gemini の応答に修正指示または完成見本説明がありません");
    }
    return {
      ...parsed,
      genre: masked.genre,
      skillTags: masked.skillTags,
      difficulty,
      cautionPoints: masked.cautionPoints,
      maskedCaseText: masked.maskedCaseText,
      maskingReport: masked.maskingReport,
    };
  },

  async generateSourceScript(
    input: GenerateSourceScriptInput,
  ): Promise<GeneratedSourceScript> {
    const prompt = `あなたは動画編集の練習用素材を作る放送作家です。編集練習のために「わざと編集が必要な箇所を含む」1人語りの台本を作ってください。この台本は音声合成でそのまま読み上げられ、利用者（編集の練習をする人）が不要な箇所をカットする素材動画になります。

条件:
- テーマ: ${input.theme}
- カット後の完成想定尺: 約${input.targetKeepSeconds}秒（読み上げ速度は1秒あたり6〜7文字で見積もる）
- 難易度: ${input.difficulty} (1=カット箇所がわかりやすい, 5=微妙で見つけにくい)

台本のルール:
- セグメントの配列で出力する。1セグメント=ひと続きの発話（または沈黙）
- kind="keep": 完成版に残す部分。自然な話し言葉にする
- kind="cut": 編集で取り除くべき部分。次の種類を混ぜる
  - cutReason="filler": 「えーっと」「あのー」などのつなぎ言葉
  - cutReason="mistake": 言い間違い（直後のkeepセグメントで正しく言い直す）
  - cutReason="retake": 同じ内容の失敗テイク（かんだ・途中で止まった）
  - cutReason="silence": 沈黙。textは空文字にし silenceSeconds に秒数(2〜5)を入れる
- cutセグメントを4〜7個、全体に散らす
- 難易度が高いほど、cutとkeepの境目を微妙にする（例: 途中まで正しい言い間違い）
- ふりがな記法（漢字《かんじ》）は絶対に使わない。音声合成がそのまま読むため
- 記号・絵文字・かっこ書きの説明は入れない

必ず有効なJSONのみを出力する。

JSONスキーマ:
{
  "title": "string（素材動画のタイトル）",
  "scenario": "string（どういう動画かの説明。職員向け）",
  "keepDurationHint": number,
  "segments": [{"text": "string", "kind": "keep|cut", "cutReason": "filler|mistake|silence|retake|null", "silenceSeconds": number|null}]
}`;

    const json = await callGemini(prompt, "source_script", 0.8);
    const parsed = JSON.parse(json) as GeneratedSourceScript;
    if (!parsed.title || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      throw new Error("Gemini の台本応答が期待した形式ではありません");
    }
    const hasCut = parsed.segments.some((s) => s.kind === "cut");
    if (!hasCut) {
      throw new Error("Gemini の台本にカット箇所が含まれていません");
    }
    return parsed;
  },

  async generatePracticeScript(
    input: GeneratePracticeScriptInput,
  ): Promise<GeneratedPracticeScriptResult> {
    const sg = input.styleGuide;
    const targetKeepSeconds = Math.round(
      (input.targetKeepMinutes && input.targetKeepMinutes > 0 ? input.targetKeepMinutes : 10) * 60,
    );
    const rawTotalSeconds = Math.round(targetKeepSeconds * 1.4); // 完成尺の1.4倍を素材総量の目安に
    const speakerList = sg.characters
      .map((c) => `- key="${c.key}" 名前=${c.name} 役割=${c.role}`)
      .join("\n");

    const prompt = `あなたは長寿YouTubeチャンネルの構成作家です。専属エディター（動画編集の練習をする人）に渡す「編集前のバラバラ素材の台本」を作ってください。
これは完成品ではありません。エディターが「残す/切る」を判断しながら1本の動画に仕上げるための"素材"です。

担当チャンネル（毎回この設定を固定して使う常連クライアント）:
- チャンネル名: ${sg.client.channelName}
- 依頼主: ${sg.client.clientName}（${sg.client.persona}）
- 視聴者層: ${sg.client.audience}
- シリーズのトーン: ${sg.seriesVoice}

登場話者（speakerKey は必ず下のkeyのどれかにする）:
${speakerList}

今回の動画:
- テーマ: ${input.theme}
- 難易度: ${input.difficulty}（1=切る候補がわかりやすい, 5=切る候補が微妙で判断が難しい）
${input.traineeNote ? `- 利用者への配慮メモ: ${input.traineeNote}` : ""}

台本のルール（重要）:
- segments 配列で出力する。1セグメント=ひと続きの発話（または沈黙）。
- priority を必ず付ける:
  - "must": 完成版に必ず残す本筋。これだけを残すと約${Math.round(targetKeepSeconds / 60)}分になるよう配分する。
  - "optional": エディターが「残す/切る」を判断する候補。cutReason を必ず付ける:
    - "filler": つなぎ言葉・言いよどみ  "tangent": 本筋から外れた雑談  "redundant": 同じ内容の繰り返し  "weak": あってもなくても良い弱い部分  "ng": 使ってはいけない失敗テイク
- must と optional を合わせた素材の総量は約${Math.round(rawTotalSeconds / 60)}分（完成尺の約1.4倍）にする。
- 冒頭の約15秒はフック（視聴維持の要）にする。フックのセグメントは isHook=true・priority="must" にする。
- 難易度が高いほど optional の判断を微妙にする（本筋に紛れた冗長・弱い部分など）。
- estimatedSeconds は各セグメントの想定尺（秒）。読み上げは1秒あたり6〜7文字で見積もる。沈黙は text を空文字にして estimatedSeconds に秒数を入れる。
- ふりがな記法（漢字《かんじ》）は絶対に使わない（音声合成がそのまま読むため）。記号・絵文字・かっこ書きの説明も入れない。
- clientMessage は ${sg.client.clientName} からの依頼メッセージ（今回の動画の説明・要望・署名まで）。毎回この人格・口調で書く。
${COMMON_STYLE}

JSONスキーマ:
{
  "title": "string（案件タイトル。例:「${sg.client.channelName} 次回の編集」）",
  "episodeTitle": "string（今回の動画タイトル。視聴者向け）",
  "clientMessage": "string（${sg.client.clientName}からの依頼メッセージ・生テキスト）",
  "scenario": "string（どんな動画かの説明。職員向け）",
  "segments": [
    { "id": "seg_1", "speakerKey": "上のkeyのどれか", "text": "string", "priority": "must|optional", "cutReason": "filler|tangent|redundant|weak|ng|null", "estimatedSeconds": number, "isHook": boolean }
  ]
}`;

    const json = await callGemini(prompt, "practice_script", 0.85);
    const parsed = JSON.parse(json) as { segments?: unknown };
    if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      throw new Error("Gemini の練習台本応答にセグメントが含まれていません");
    }
    return normalizePracticeScript(parsed, sg, targetKeepSeconds);
  },

  async gradeSubmission(input: GradeSubmissionInput): Promise<GradeResult> {
    const prompt = `あなたは動画編集トレーニングの採点者です。利用者の提出を採点してください。

課題: ${input.taskTitle}
依頼書:
${input.requestDoc}

提出情報:
- セルフチェック結果: ${JSON.stringify(input.selfCheck)}
- 利用者のコメント: ${input.note ?? "（なし）"}
- 作業時間: ${input.workMinutes ?? "不明"}分（目安: ${input.estimatedMinutes ?? "不明"}分）
- 再提出: ${input.isResubmission ? "はい" : "いいえ"}

採点方針:
- 動画ファイルの中身は見られないため、セルフチェック・作業時間・コメントから「指示理解・納期意識・報告相談」を評価する
- 良かった点を必ず1つ以上挙げる。改善点は責めずに次の行動を示す
${COMMON_STYLE}

JSONスキーマ:
{
  "score": number (0-100),
  "summary": "string（2文以内の総評）",
  "goodPoints": ["string"],
  "improvePoints": ["string"],
  "criteria": [{"key": "string", "label": "string", "score": number (0-5), "comment": "string"}]
}`;

    const json = await callGemini(prompt, "grade");
    const parsed = JSON.parse(json) as GradeResult;
    if (typeof parsed.score !== "number" || !parsed.summary) {
      throw new Error("Gemini の応答が期待した形式ではありません");
    }
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    return parsed;
  },
};
