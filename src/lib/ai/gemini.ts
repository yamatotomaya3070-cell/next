import type {
  AiProvider,
  GenerateCaseGuideInput,
  GeneratedCaseGuide,
  GenerateSimilarCaseInput,
  GenerateSourceScriptInput,
  GenerateTaskInput,
  GeneratedSimilarCase,
  GeneratedSourceScript,
  GeneratedTask,
  GradeResult,
  GradeSubmissionInput,
  MaskingReport,
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** AI利用ログの用途区分（コスト集計の内訳に使う） */
type AiUsageKind = "task" | "similar_case" | "mask" | "source_script" | "grade" | "case_guide";

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
- 一文は短く。平易な日本語。専門用語には説明を添える。
- 漢字には必ず「漢字《かんじ》」の形式でふりがなを付ける（熟語単位）。
- 否定的・威圧的な表現は使わない。励ます表現を使う。
- 必ず有効なJSONのみを出力する。`;

/**
 * requestDoc（依頼書＝依頼文＋案件仕様書）の書き方ガイド。
 * クラウドワークスの実案件と同等の情報量・具体性を担保し、ジャンルと難易度で内容を変える。
 * 仕様書を独立テーブルにせず requestDoc(Markdown) に構造化して埋め込むことで、
 * 既存の教材表示（request_doc をMarkdown表示）のまま質を上げる。
 */
const REQUEST_DOC_GUIDANCE = `
requestDoc は「実際のクライアントから届いた依頼文」と「案件仕様書」を1つにまとめた Markdown にする。
次の見出し構成を必ず守り、各項目を具体的に埋める（空欄や「特になし」で済ませない）:

# 依頼文
クライアントからの自然なメッセージ。あいさつ→作ってほしい動画→目的→想定視聴者→掲載する媒体→
雰囲気の希望→参考のイメージ→納期感、の流れ。実在の企業名・商品名・URLは出さず「あるお店」「ある商品」等にする。

# 案件仕様書
## 基本情報
- 目的 / ターゲット視聴者 / 掲載媒体（YouTube・TikTok・店頭など） / ジャンル
## 動画仕様
- 完成尺 / 画面比率（16:9・9:16など） / 解像度 / ファイル形式（MP4 H.264 など） / ファイル名ルール
## 編集ルール
- テロップ（色・位置・動きの有無・強調の仕方） / BGM（雰囲気・音量） / 効果音 /
  カットとテンポ / 必要なら Bロール・画像・図解の入れ方
## 参考
- 参考動画・参考イメージの説明（URLは書かず、雰囲気や構成を言葉で伝える）
## 納品
- 納期 / 提出方法
## 要確認事項
- 依頼に書かれておらず曖昧で、本来クライアントに確認すべき点を2〜4個。
  （就労者が「わからないことを相談する」練習になる。ここは空にしない）

ジャンルに合った現実的な仕様にする（例: TikTok/Reelsは9:16・15〜60秒・テンポ速め・大きめテロップ、
YouTube解説は16:9・数分・テロップ多め・Bロールあり、商品紹介は短尺・訴求重視・ロゴやキャッチコピー）。
難易度が低いほど仕様は具体的で親切に、曖昧さを少なくする。難易度が高いほど指示を簡素にし、
要確認事項を増やし、就労者に構成や表現を判断させる余地を残す。`;

/** manualSteps（手順書）の書き方ガイド。ジャンルの実際の作業順に沿わせる。 */
const MANUAL_GUIDANCE = `
manualSteps は上の仕様書とジャンルに沿った実際の編集作業順にする:
素材の確認 → 全体の構成を考える → カット → テロップ → BGM・効果音 → 見直し → 書き出し・提出。
1ステップ=1操作で細かく分ける。難易度が高いほど各ステップの指示は簡素にし、判断を就労者に任せる。`;

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
1. requestDoc: 下記ガイドに従った「依頼文＋案件仕様書」（Markdown）
${REQUEST_DOC_GUIDANCE}
2. manualSteps: 操作手順書（5〜12ステップ）。各ステップに text（やること）と tip（コツや励まし、なければnull）
${MANUAL_GUIDANCE}
3. script: 字幕・テロップ用の台本（テロップ課題でなければ null）
4. selfCheckItems: 納品前セルフチェック項目（4〜6個、ふりがな不要）。仕様書の指定（尺・比率・形式・テロップ・BGM等）と対応させる
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
1. readableRequestDoc: 上の依頼文を、利用者向けに読みやすく整えた依頼書（Markdown）。
   ${REQUEST_DOC_GUIDANCE}
   ただし今回は「実案件を整形する」ことが目的。依頼文に書かれた要求は忠実に残し、書かれていない仕様は「要確認事項」に回す（勝手に創作しない）。
   実在の企業名・個人名・連絡先・URLが依頼文に含まれる場合は「あるお店」「依頼者」等に置き換える。
2. manualSteps: この案件をこなすための操作手順書（5〜12ステップ）。各ステップに text と tip（コツや励まし、なければnull）。
   ${MANUAL_GUIDANCE}
3. selfCheckItems: 納品前セルフチェック項目（4〜6個、ふりがな不要）。依頼の指定（尺・比率・形式・テロップ・BGM等）と対応させる。
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
1. requestDoc: 下記ガイドに従った「依頼文＋案件仕様書」（Markdown）。実案件と同じ種類の要求水準を保つ
${REQUEST_DOC_GUIDANCE}
2. manualSteps: 操作手順書（5〜12ステップ）。各ステップに text（やること）と tip（コツや励まし、なければnull）
${MANUAL_GUIDANCE}
3. script: 字幕・テロップ用の台本（テロップ課題でなければ null）
4. selfCheckItems: 納品前セルフチェック項目（4〜6個、ふりがな不要）。仕様書の指定と対応させる
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
  "summary": "string（2文以内の総評。ふりがな付き）",
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
