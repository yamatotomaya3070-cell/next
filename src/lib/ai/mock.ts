import type {
  AiProvider,
  GenerateCaseGuideInput,
  GeneratedCaseGuide,
  GenerateSimilarCaseInput,
  GenerateSourceScriptInput,
  GeneratedSimilarCase,
  GeneratedSourceScript,
  GenerateTaskInput,
  GeneratedTask,
  GradeResult,
  GradeSubmissionInput,
} from "./types";
import { SKILL_TAG_LABELS } from "@/lib/types";

/** 決定的な簡易マスキング（モック用。本番はAI+職員確認で行う） */
function maskCaseText(raw: string): { masked: string; removedItems: string[] } {
  const removedItems: string[] = [];
  let masked = raw;

  const rules: Array<{ pattern: RegExp; replace: string; label: string }> = [
    { pattern: /https?:\/\/\S+/g, replace: "（URL削除）", label: "URLを削除" },
    { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/g, replace: "（連絡先削除）", label: "メールアドレスを削除" },
    { pattern: /(株式会社|合同会社|有限会社)[^\s、。]+/g, replace: "依頼者", label: "会社名を「依頼者」に置換" },
    { pattern: /[0-9,，]+円/g, replace: "（金額削除）", label: "報酬額を削除" },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(masked)) {
      masked = masked.replace(rule.pattern, rule.replace);
      removedItems.push(rule.label);
    }
  }
  return { masked, removedItems };
}

/** 実案件テキストから練習スキルを推定（モック用の単純キーワード判定） */
function estimateSkillTags(raw: string): string[] {
  const found = [
    ...(/(テロップ|字幕)/.test(raw) ? ["telop"] : []),
    ...(/(BGM|効果音|SE)/i.test(raw) ? ["bgm"] : []),
    ...(/(カット|切り抜き|不要な部分)/.test(raw) ? ["cut"] : []),
  ];
  return found.length > 0 ? [...found, "export"] : ["cut", "export"];
}

/**
 * モックAIプロバイダ。
 * GEMINI_API_KEY 未設定の開発・デモ環境で、決定的な教材/採点を返す。
 */
export const mockProvider: AiProvider = {
  name: "mock",

  async generateTask(input: GenerateTaskInput): Promise<GeneratedTask> {
    const skills = input.skillTags
      .map((t) => SKILL_TAG_LABELS[t] ?? t)
      .join("・");
    const minutes = 40 + input.difficulty * 20;
    const hasTelop = input.skillTags.includes("telop");

    return {
      title: `【練習】${input.theme}`,
      summary: `${skills}の練習です。むずかしさは${"★".repeat(input.difficulty)}です。`,
      estimatedMinutes: minutes,
      dueInDays: 2 + input.difficulty,
      requestDoc: [
        `## お仕事《しごと》の依頼書《いらいしょ》（練習用《れんしゅうよう》）`,
        ``,
        `お世話《せわ》になります。動画《どうが》の編集《へんしゅう》をお願《ねが》いします。`,
        ``,
        `### やってほしいこと`,
        `- テーマ: ${input.theme}`,
        `- 使《つか》うスキル: ${skills}`,
        `- 完成《かんせい》までの目安《めやす》: 約${minutes}分`,
        ``,
        `### 納品《のうひん》について`,
        `- 形式《けいしき》: MP4（1920x1080）`,
        `- ファイル名《めい》: 「kadai_名前.mp4」`,
        ``,
        `わからないことがあれば、遠慮《えんりょ》なく質問《しつもん》してください。`,
      ].join("\n"),
      manualSteps: [
        {
          text: "依頼書《いらいしょ》を最後《さいご》まで読《よ》みます。",
          tip: "わからない言葉があったら「質問する」ボタンで聞いてください。",
        },
        {
          text: "編集《へんしゅう》ソフトを開《ひら》いて、素材《そざい》を読《よ》み込《こ》みます。",
          tip: "素材ファイルはデスクトップの「練習素材」フォルダにあります。",
        },
        {
          text: `${input.theme}の作業《さぎょう》を、依頼書のとおりに進《すす》めます。`,
          tip: "一度にぜんぶやらなくて大丈夫です。少しずつ進めましょう。",
        },
        {
          text: "できあがったら、全体《ぜんたい》を一度《いちど》見直《みなお》します。",
          tip: "チェックリストを使うと見直しがしやすいです。",
        },
        {
          text: "MP4形式《けいしき》で書《か》き出《だ》して、提出《ていしゅつ》します。",
          tip: "書き出し中は休憩してもOKです。",
        },
      ],
      script: hasTelop
        ? [
            "こんにちは。今日は かんたんレシピを 紹介します。",
            "材料は たまご 2つと ごはんです。",
            "フライパンを 中火で あたためます。",
            "できあがり! ぜひ 作ってみてください。",
          ].join("\n")
        : null,
      selfCheckItems: [
        "依頼書に書いてある長さになっている",
        "指定されたファイル形式（MP4）で書き出した",
        "ファイル名を指定どおりにつけた",
        "最初から最後まで一度見直した",
        "音量がうるさすぎず、小さすぎない",
      ],
    };
  },

  async generateCaseGuide(input: GenerateCaseGuideInput): Promise<GeneratedCaseGuide> {
    // モック: 実案件テキストはそのまま依頼書に載せ（軽い匿名化のみ）、汎用の手順書を返す。
    const { masked } = maskCaseText(input.caseText);
    const skillTags = estimateSkillTags(input.caseText);
    const base = await this.generateTask({
      theme: "受注した動画編集の案件",
      difficulty: 3,
      skillTags,
      traineeNote: input.traineeNote,
    });
    return {
      title: "受注案件（動画編集）",
      summary: "実際に受注した動画編集のお仕事です。手順書を見ながら進めましょう。",
      skillTags,
      difficulty: 3,
      estimatedMinutes: base.estimatedMinutes,
      readableRequestDoc: [
        `## お仕事《しごと》の依頼書《いらいしょ》`,
        ``,
        `実際《じっさい》に届《とど》いた依頼《いらい》の内容《ないよう》です。`,
        ``,
        masked,
        ``,
        `わからないことがあれば、遠慮《えんりょ》なく質問《しつもん》してください。`,
      ].join("\n"),
      manualSteps: base.manualSteps,
      selfCheckItems: base.selfCheckItems,
    };
  },

  async generateSimilarCase(
    input: GenerateSimilarCaseInput,
  ): Promise<GeneratedSimilarCase> {
    const { masked, removedItems } = maskCaseText(input.rawCaseText);
    const skillTags = estimateSkillTags(input.rawCaseText);
    const difficulty = input.difficulty ?? 2;
    const theme = skillTags.includes("telop")
      ? "お店の紹介動画にテロップを入れる"
      : "お店の紹介動画のカット編集";

    const base = await this.generateTask({
      theme,
      difficulty,
      skillTags,
      traineeNote: input.traineeNote,
    });

    return {
      ...base,
      genre: "ad",
      skillTags,
      difficulty,
      revisionNote: [
        "納品《のうひん》ありがとうございます。確認《かくにん》しました。",
        "2点《てん》だけ修正《しゅうせい》をお願《ねが》いします。",
        "1. 冒頭《ぼうとう》のあいさつの前《まえ》の無音《むおん》部分《ぶぶん》をカットしてください。",
        "2. 最後《さいご》のテロップの表示《ひょうじ》時間《じかん》を1秒《びょう》長《なが》くしてください。",
        "お手数《てすう》ですが、よろしくお願《ねが》いします。",
      ].join("\n"),
      sampleDescription: [
        "完成見本のポイント:",
        "- 指定された完成尺に収まっている",
        "- 無音・言い間違いの部分がカットされている",
        ...(skillTags.includes("telop") ? ["- 台本どおりのテロップが読みやすい位置に入っている"] : []),
        "- 指定のファイル名・形式（MP4）で書き出されている",
      ].join("\n"),
      cautionPoints: [
        "完成尺の指定を守る",
        "指定されたファイル名の規則で納品する",
        "テロップの誤字・脱字がないか確認する",
      ],
      maskedCaseText: masked,
      maskingReport: {
        removedItems,
        riskNotes: [
          "モック生成のため、匿名化の内容を職員が必ず確認してください。",
        ],
      },
    };
  },

  async generateSourceScript(
    input: GenerateSourceScriptInput,
  ): Promise<GeneratedSourceScript> {
    return {
      title: `${input.theme}（練習素材）`,
      scenario:
        `${input.theme}を想定した1人語りの素材動画です。` +
        "つなぎ言葉・言い間違い・沈黙・失敗テイクが混ざっており、カット編集の練習に使います。",
      keepDurationHint: input.targetKeepSeconds,
      segments: [
        { text: "こんにちは。今日は私たちのお店を紹介します。", kind: "keep", cutReason: null, silenceSeconds: null },
        { text: "えーっと、あのー。", kind: "cut", cutReason: "filler", silenceSeconds: null },
        { text: "このお店は駅から歩いて5分の場所にあります。", kind: "keep", cutReason: null, silenceSeconds: null },
        { text: "営業時間は朝9時から、あ、すみません、間違えました。", kind: "cut", cutReason: "mistake", silenceSeconds: null },
        { text: "営業時間は朝8時から夕方6時までです。", kind: "keep", cutReason: null, silenceSeconds: null },
        { text: "", kind: "cut", cutReason: "silence", silenceSeconds: 3 },
        { text: "おすすめは焼きたてのパンと、季節のスープです。", kind: "keep", cutReason: null, silenceSeconds: null },
        { text: "おすすめは焼きたての、えっと、ちょっと待ってください。", kind: "cut", cutReason: "retake", silenceSeconds: null },
        { text: "ぜひ一度、遊びに来てください。お待ちしています。", kind: "keep", cutReason: null, silenceSeconds: null },
      ],
    };
  },

  async gradeSubmission(input: GradeSubmissionInput): Promise<GradeResult> {
    const checkedCount = input.selfCheck.filter((c) => c.checked).length;
    const totalCount = input.selfCheck.length || 1;
    const checkRatio = checkedCount / totalCount;

    const onTime =
      input.workMinutes == null ||
      input.estimatedMinutes == null ||
      input.workMinutes <= input.estimatedMinutes * 1.5;

    const base = 55 + Math.round(checkRatio * 30) + (onTime ? 10 : 0);
    const score = Math.min(100, base + (input.note ? 5 : 0));

    return {
      score,
      summary:
        score >= 80
          ? "とてもよくできました。依頼書のとおりに作業できています。"
          : "提出おつかれさまでした。次に直すところを見て、もう一度チャレンジしましょう。",
      goodPoints: [
        "最後まで提出できました",
        ...(checkRatio === 1 ? ["チェックリストを全部確認できました"] : []),
        ...(input.note ? ["工夫した点をコメントで伝えられました"] : []),
        ...(onTime ? ["目安の時間内に作業できました"] : []),
      ],
      improvePoints: [
        ...(checkRatio < 1
          ? ["チェックリストで確認していない項目があります。提出前にもう一度見直しましょう"]
          : []),
        ...(!onTime
          ? ["目安より時間がかかりました。困ったときは早めに相談しましょう"]
          : []),
        ...(checkRatio === 1 && onTime
          ? ["次はもう少しむずかしい課題に挑戦してみましょう"]
          : []),
      ],
      criteria: [
        {
          key: "instruction",
          label: "指示どおりに作業できたか",
          score: Math.max(1, Math.round(checkRatio * 5)),
          comment: "セルフチェックの結果から判定しました。",
        },
        {
          key: "deadline",
          label: "時間・納期",
          score: onTime ? 5 : 3,
          comment: onTime
            ? "目安時間内に完了できました。"
            : "時間がかかりました。作業を分けて進めてみましょう。",
        },
        {
          key: "communication",
          label: "報告・相談",
          score: input.note ? 4 : 3,
          comment: input.note
            ? "コメントで作業内容を伝えられました。"
            : "提出時にひとことコメントを書くと、もっと良くなります。",
        },
      ],
    };
  },
};
