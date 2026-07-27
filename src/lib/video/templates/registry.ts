import type { VideoTemplateConfig, VideoTemplateType } from "./types";

export const TEMPLATE_REGISTRY: Record<VideoTemplateType, VideoTemplateConfig> = {
  character_explainer: {
    type: "character_explainer",
    label: "キャラクター解説",
    description:
      "2人のオリジナルキャラクター（アオ・ミドリ）が掛け合いでテーマを解説する、ゆっくり解説風の動画です。",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationRange: { min: 30, max: 300, default: 60 },
    requiredAssetKinds: ["話者ごとの音声", "背景画像", "立ち絵（表情差分）", "BGM", "台本・字幕データ"],
    subtitleStyle: { maxCharsPerLine: 22, maxLines: 2, fontSize: 58, marginBottom: 64 },
    traineeTasks: [
      "支給音声を指示書の順番どおりに配置する",
      "話者ごとに色分けした字幕を挿入する",
      "背景・立ち絵を配置する",
      "BGMを低音量で全体に流す",
    ],
    aiPregenTasks: ["台本の生成", "2話者の音声合成", "字幕タイミングの算出", "立ち絵・背景の用意"],
    skillTags: ["cut", "telop", "bgm", "export"],
    defaultDifficulty: 1,
    gradingCriteria: ["音声の配置順序", "字幕の色分けと同期", "BGM音量", "完成尺"],
    toleranceSec: 1.0,
  },

  vertical_short: {
    type: "vertical_short",
    label: "縦型ショート動画",
    description:
      "スマホ視聴向けの縦型（9:16）ショート動画です。アオ・ミドリが短いテンポで1つの話題を解説します。",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    durationRange: { min: 15, max: 60, default: 30 },
    requiredAssetKinds: ["話者ごとの音声", "縦型背景画像", "立ち絵（表情差分）", "BGM", "台本・字幕データ"],
    subtitleStyle: { maxCharsPerLine: 14, maxLines: 2, fontSize: 66, marginBottom: 180 },
    traineeTasks: [
      "支給音声を指示書の順番どおりに配置する",
      "大きめの字幕を画面中央下に読みやすく配置する",
      "テンポよく間を詰めて編集する",
      "BGMを低音量で全体に流す",
    ],
    aiPregenTasks: ["短尺向け台本の生成", "2話者の音声合成", "字幕タイミングの算出"],
    skillTags: ["cut", "telop", "bgm", "duration", "export"],
    defaultDifficulty: 2,
    gradingCriteria: ["テンポ（間の長さ）", "字幕の視認性", "完成尺が短尺に収まっているか"],
    toleranceSec: 0.7,
  },

  business_explainer: {
    type: "business_explainer",
    label: "ビジネス・教育系解説",
    description:
      "1人のナレーターがスライド形式でビジネス・教育トピックを解説する、落ち着いたトーンの動画です。",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationRange: { min: 60, max: 240, default: 90 },
    requiredAssetKinds: ["ナレーション音声", "スライド背景", "タイトル・箇条書きテキストデータ", "BGM"],
    subtitleStyle: { maxCharsPerLine: 26, maxLines: 2, fontSize: 50, marginBottom: 60 },
    traineeTasks: [
      "支給音声をスライドの順番どおりに配置する",
      "スライドのタイトル・箇条書きを指示書どおりに配置する",
      "字幕を1色で統一して挿入する",
      "スライド切り替えに簡単なトランジションを入れる",
    ],
    aiPregenTasks: ["スライド構成・台本の生成", "ナレーション音声合成", "字幕タイミングの算出"],
    skillTags: ["cut", "telop", "image", "export"],
    defaultDifficulty: 2,
    gradingCriteria: ["スライドと音声の同期", "箇条書きの正確さ", "字幕の統一感", "完成尺"],
    toleranceSec: 1.5,
  },

  product_promotion: {
    type: "product_promotion",
    label: "商品・サービス紹介",
    description: "商品/サービスの特徴を訴求するプロモーション動画。準備中のテンプレートです。",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationRange: { min: 30, max: 90, default: 45 },
    requiredAssetKinds: ["商品画像", "キャッチコピーテキスト", "BGM"],
    subtitleStyle: { maxCharsPerLine: 20, maxLines: 2, fontSize: 56, marginBottom: 64 },
    traineeTasks: ["準備中"],
    aiPregenTasks: ["準備中"],
    skillTags: ["telop", "bgm", "image", "export"],
    defaultDifficulty: 2,
    gradingCriteria: ["準備中"],
    toleranceSec: 1.0,
  },

  interview_edit: {
    type: "interview_edit",
    label: "対談・インタビュー編集",
    description:
      "聞き手（インタビュアー）と話し手の2人による対談の「未編集素材」を生成します。フィラー・言い間違い・沈黙・言い直しを意図的に含み、就労者がそれをカットして仕上げる実務型の練習です。",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationRange: { min: 60, max: 240, default: 90 },
    requiredAssetKinds: ["未編集の対談音声（連続収録）", "話者ラベル付き素材リスト", "背景画像", "BGM"],
    subtitleStyle: { maxCharsPerLine: 24, maxLines: 2, fontSize: 52, marginBottom: 64 },
    traineeTasks: [
      "不要な部分（フィラー・言い間違い・沈黙・言い直し）をカットする",
      "残す発言をつなぎ、自然な会話になるよう編集する",
      "話者ごとに字幕を色分けして挿入する",
      "指定の完成尺に収める",
    ],
    aiPregenTasks: ["対談台本（カット箇所を含む）の生成", "2話者の音声合成", "カット箇所の正解データ化"],
    skillTags: ["cut", "telop", "revision", "duration", "export"],
    defaultDifficulty: 3,
    gradingCriteria: ["不要箇所が正しくカットされているか", "会話の自然さ", "完成尺", "字幕の色分け"],
    toleranceSec: 1.5,
  },

  vlog_edit: {
    type: "vlog_edit",
    label: "Vlog・YouTubeバラエティ",
    description: "日常や体験を紹介するVlog風動画。準備中のテンプレートです。",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationRange: { min: 60, max: 180, default: 90 },
    requiredAssetKinds: ["ナレーション音声", "シーン背景", "テロップテキスト", "BGM・SE"],
    subtitleStyle: { maxCharsPerLine: 20, maxLines: 2, fontSize: 54, marginBottom: 64 },
    traineeTasks: ["準備中"],
    aiPregenTasks: ["準備中"],
    skillTags: ["cut", "telop", "bgm", "export"],
    defaultDifficulty: 2,
    gradingCriteria: ["準備中"],
    toleranceSec: 1.5,
  },
};

export function getTemplateConfig(type: VideoTemplateType): VideoTemplateConfig {
  return TEMPLATE_REGISTRY[type];
}

export function isTemplateImplemented(type: VideoTemplateType): boolean {
  return type === "character_explainer" || type === "vertical_short" || type === "business_explainer" || type === "interview_edit";
}
