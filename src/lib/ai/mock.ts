import type {
  AiProvider,
  GenerateCaseGuideInput,
  GeneratedCaseGuide,
  GeneratePracticeScriptInput,
  GeneratedPracticeScriptResult,
  GenerateSimilarCaseInput,
  GenerateSourceScriptInput,
  GeneratedSimilarCase,
  GeneratedSourceScript,
  GenerateTaskInput,
  GeneratedTask,
  GradeResult,
  GradeSubmissionInput,
  ProposeStyleGuidesInput,
  StyleGuideProposal,
} from "./types";
import { SKILL_TAG_LABELS } from "@/lib/types";
import { normalizeStyleGuide } from "@/lib/style-guide/schema";
import { normalizePracticeScript } from "@/lib/practice-script/schema";

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

  async proposeStyleGuides(input: ProposeStyleGuidesInput): Promise<StyleGuideProposal> {
    const charCount =
      input.characterCount && input.characterCount >= 1 && input.characterCount <= 4
        ? Math.floor(input.characterCount)
        : 2;
    const count = input.count && input.count >= 1 && input.count <= 5 ? Math.floor(input.count) : 3;

    // 3種の異なる方向性のプリセット（実APIキー未設定時のフォールバック用）。
    // normalizeStyleGuide を通すのでキャラ数調整・HEX検証は自動で担保される。
    const presets = [
      {
        name: "つなぐ雑学ラボ",
        artStyle: "やわらかいアニメ調。パステル寄りのフラット塗り、線は細め。",
        client: {
          channelName: "つなぐ雑学ラボ",
          clientName: "ラボ長",
          persona: "毎回きさくに『いつもありがとう！』と声をかける、雑学好きの個人YouTuber。",
          audience: "通勤・休憩中にスマホで見る幅広い年代",
        },
        palette: { background: "#F4F7FB", primary: "#1677E8", accent: "#FFB020", telopOutline: "#1B2A4A" },
        seriesVoice: "やさしく丁寧。専門用語は必ず言い換える初心者ファースト。",
      },
      {
        name: "ナイトモード雑談",
        artStyle: "落ち着いたダーク調のアニメ塗り。ネオンのアクセントを効かせる。",
        client: {
          channelName: "ナイトモード雑談",
          clientName: "ナイト",
          persona: "深夜にゆるく語る系の個人YouTuber。落ち着いた口調で細かく指定する。",
          audience: "夜にゆっくり視聴する20〜30代",
        },
        palette: { background: "#161A24", primary: "#7C5CFF", accent: "#33E0C0", telopOutline: "#0A0D14" },
        seriesVoice: "落ち着いた語り口。テンポはゆっくりめ、余白を大切にする。",
      },
      {
        name: "ポップ解説チャンネル",
        artStyle: "彩度高めのポップなアニメ調。太い輪郭で元気な印象。",
        client: {
          channelName: "ポップ解説チャンネル",
          clientName: "ポプ子",
          persona: "テンション高めで前向きな個人YouTuber。『サクッといきましょう！』が口ぐせ。",
          audience: "テンポの良い動画を好む若年層",
        },
        palette: { background: "#FFF6E9", primary: "#FF5A5F", accent: "#00B8D9", telopOutline: "#2A1A3A" },
        seriesVoice: "明るくテンポよく。要点を短く歯切れよく伝える。",
      },
    ];

    const characters = Array.from({ length: charCount }, (_, i) => ({
      key: `char_${i + 1}`,
      name: i === 0 ? "アオ" : i === 1 ? "ミドリ" : `キャラ${i + 1}`,
      role: i === 0 ? "進行役" : "解説役",
    }));

    const guides = presets.slice(0, count).map((p) =>
      normalizeStyleGuide({
        name: p.name,
        artStyle: p.artStyle,
        client: p.client,
        palette: p.palette,
        seriesVoice: p.seriesVoice,
        characters,
      }),
    );
    return { guides };
  },

  async generateTask(input: GenerateTaskInput): Promise<GeneratedTask> {
    const skills = input.skillTags
      .map((t) => SKILL_TAG_LABELS[t] ?? t)
      .join("・");
    const minutes = 40 + input.difficulty * 20;
    const hasTelop = input.skillTags.includes("telop");
    const hasBgm = input.skillTags.includes("bgm");
    // 縦長ジャンルの簡易判定（決定的）。該当しなければ横長16:9。
    const isVertical = /(tiktok|ティックトック|reel|リール|ショート|short|縦)/i.test(
      `${input.theme} ${input.genre ?? ""}`,
    );
    const durationSec = 45 + input.difficulty * 10;

    return {
      title: `【練習】${input.theme}`,
      summary: `${skills}の練習です。むずかしさは${"★".repeat(input.difficulty)}です。`,
      estimatedMinutes: minutes,
      dueInDays: 2 + input.difficulty,
      requestDoc: [
        `━━━━━━━━━━━━`,
        `依頼文`,
        `━━━━━━━━━━━━`,
        `お世話になります。「${input.theme}」の動画を作っていただきたく、ご連絡しました。`,
        `見てくれた人に内容がやさしく伝わる、明るい雰囲気の動画にしたいです。よろしくお願いします。`,
        ``,
        `━━━━━━━━━━━━`,
        `案件仕様書`,
        `━━━━━━━━━━━━`,
        ``,
        `【1. この動画について】`,
        `・目的：「${input.theme}」をわかりやすく伝える`,
        `・見る人：はじめてこの話題にふれる一般の方`,
        `・載せる場所：${isVertical ? "TikTok・Instagramリール" : "YouTube"}`,
        `・雰囲気：明るく、やさしい`,
        ``,
        `【2. 納品するもの（動画の仕様）】`,
        `・長さ：${durationSec}秒（±5秒までOK）`,
        `・画面比率：${isVertical ? "9:16（縦長）" : "16:9（横長）"}`,
        `・解像度：${isVertical ? "1080×1920" : "1920×1080"}`,
        `・なめらかさ：30fps`,
        `・ファイル形式：MP4（H.264）`,
        `・ファイル名：例）kadai_太郎.mp4`,
        ``,
        `【3. 使う素材】`,
        `・支給される素材：練習用の素材フォルダにある動画・画像`,
        `・自分で用意する素材：${hasBgm ? "BGM・効果音（商用利用OKの無料素材を使う）" : "なし"}`,
        ``,
        `【4. 編集のルール】`,
        `・テロップ：${hasTelop ? "大事な言葉に入れる。画面下の中央、読みやすい大きさ、1つ2〜3秒表示" : "今回は入れなくてよい"}`,
        `・カットとテンポ：不要な間や言い間違いを削る。目安は1分あたり8〜12カット`,
        `・音の大きさ：声がはっきり聞こえるように。うるさすぎ・小さすぎを避ける`,
        `・BGM・効果音：${hasBgm ? "明るいBGMを小さめに。声のじゃまをしない" : "なし"}`,
        `・はじめと終わり：短いタイトルを最初に、最後に「おわり」を入れる`,
        `・場面の切り替え：はやい切り替えは使わず、そのままつなぐ`,
        ``,
        `【5. やること・やらないこと】`,
        `・やること：素材の確認、カット、${hasTelop ? "テロップ、" : ""}${hasBgm ? "BGM、" : ""}音量調整、書き出し`,
        `・やらないこと：サムネイル作成、素材の撮影`,
        ``,
        `【6. 参考】`,
        `・同じ話題の、テロップが大きく読みやすい動画をイメージ。派手な演出より「伝わりやすさ」を大切に`,
        ``,
        `【7. 納品】`,
        `・納期：${2 + input.difficulty}日以内`,
        `・出し方：このアプリの「提出」から動画をアップロード`,
        ``,
        `【8. 確認したいこと】`,
        `・BGMの雰囲気は、明るめと落ち着いた感じのどちらがよいですか？`,
        `・テロップの色に決まりはありますか？`,
      ].join("\n"),
      manualSteps: [
        {
          text: "依頼書を最後まで読みます。",
          tip: "わからない言葉があったら「質問する」ボタンで聞いてください。",
        },
        {
          text: "編集ソフトを開いて、素材を読み込みます。",
          tip: "素材ファイルはデスクトップの「練習素材」フォルダにあります。",
        },
        {
          text: `${input.theme}の作業を、依頼書のとおりに進めます。`,
          tip: "一度にぜんぶやらなくて大丈夫です。少しずつ進めましょう。",
        },
        {
          text: "できあがったら、全体を一度見直します。",
          tip: "チェックリストを使うと見直しがしやすいです。",
        },
        {
          text: "MP4形式で書き出して、提出します。",
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
        `長さは約${durationSec}秒（±5秒）におさまっている`,
        `画面比率と解像度が指定どおり（${isVertical ? "9:16 / 1080×1920" : "16:9 / 1920×1080"}）`,
        "MP4（H.264）で書き出した",
        "ファイル名を指定のルールでつけた",
        ...(hasTelop ? ["テロップの誤字・脱字がなく、読みやすい大きさ・位置になっている"] : []),
        "声がはっきり聞こえ、音量がうるさすぎず小さすぎない",
        "最初から最後まで一度見直した",
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
        `━━━━━━━━━━━━`,
        `依頼文`,
        `━━━━━━━━━━━━`,
        `実際に届いた依頼の内容です。`,
        ``,
        masked,
        ``,
        `━━━━━━━━━━━━`,
        `作業のポイント`,
        `━━━━━━━━━━━━`,
        `・依頼に書かれた指定（長さ・形式・ファイル名など）は必ず守る`,
        `・書かれていないことは、勝手に決めず「質問する」から確認する`,
        `・提出の前にチェックリストで見直す`,
        ``,
        `わからないことがあれば、遠慮なく質問してください。`,
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
        "納品ありがとうございます。確認しました。",
        "2点だけ修正をお願いします。",
        "1. 冒頭のあいさつの前の無音部分をカットしてください。",
        "2. 最後のテロップの表示時間を1秒長くしてください。",
        "お手数ですが、よろしくお願いします。",
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

  async generatePracticeScript(
    input: GeneratePracticeScriptInput,
  ): Promise<GeneratedPracticeScriptResult> {
    const sg = input.styleGuide;
    const target = Math.round(
      (input.targetKeepMinutes && input.targetKeepMinutes > 0 ? input.targetKeepMinutes : 10) * 60,
    );
    const keys = sg.characters.map((c) => c.key);
    const speaker = (i: number) => keys[i % keys.length];

    type RawSeg = {
      speakerKey: string;
      text: string;
      priority: "must" | "optional";
      cutReason: string | null;
      estimatedSeconds: number;
      isHook: boolean;
    };
    const segments: RawSeg[] = [];

    // 冒頭フック（must・12秒）
    segments.push({
      speakerKey: speaker(0),
      text: `きょうのテーマは「${input.theme}」。はじめての人にもわかるように、順番に説明していきます。`,
      priority: "must",
      cutReason: null,
      estimatedSeconds: 12,
      isHook: true,
    });

    // 本筋（must）を約40秒ずつ、target に達するまで詰める
    const MUST_CHUNK = 40;
    let mustFilled = 12;
    let idx = 1;
    while (mustFilled < target) {
      const secs = Math.min(MUST_CHUNK, target - mustFilled);
      if (secs < 5) break;
      segments.push({
        speakerKey: speaker(idx),
        text: `${input.theme}のポイント その${idx}について、具体的に話します。ここは本筋なので必ず残します。`,
        priority: "must",
        cutReason: null,
        estimatedSeconds: secs,
        isHook: false,
      });
      mustFilled += secs;
      idx += 1;
    }

    // 切る候補（optional）を約0.4×target 分。理由を循環させる
    const cutReasons = ["filler", "tangent", "redundant", "weak", "ng"] as const;
    const optionalTexts = [
      "えーっと、あのー、ちょっと言葉に詰まってしまいました。",
      "そういえば昨日の晩ごはんの話なんですけど、これは本筋と関係ないですね。",
      "さっきも同じことを言いましたが、もう一度くり返します。",
      "この部分は、あってもなくても大丈夫なゆるい雑談です。",
      "すみません、今のは失敗テイクです。使わないでください。",
    ];
    const optionalTarget = Math.round(target * 0.4);
    const OPT_CHUNK = 24;
    let optFilled = 0;
    let oi = 0;
    while (optFilled < optionalTarget) {
      const secs = Math.min(OPT_CHUNK, optionalTarget - optFilled);
      if (secs < 5) break;
      segments.push({
        speakerKey: speaker(oi),
        text: optionalTexts[oi % optionalTexts.length],
        priority: "optional",
        cutReason: cutReasons[oi % cutReasons.length],
        estimatedSeconds: secs,
        isHook: false,
      });
      optFilled += secs;
      oi += 1;
    }

    return normalizePracticeScript(
      {
        title: `${sg.client.channelName} 次回動画の編集`,
        episodeTitle: input.theme,
        clientMessage:
          `いつもありがとうございます。次回の動画「${input.theme}」の編集をお願いします。\n` +
          `いつもどおり、いらない部分はカットして、テンポよく仕上げてもらえたら助かります。よろしくお願いします。\n${sg.client.clientName}`,
        scenario: `${sg.client.channelName}の通常回。素材には残す本筋と、切る候補（雑談・言いよどみ・重複・失敗テイク）が混在しています。`,
        segments,
      },
      sg,
      target,
    );
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
