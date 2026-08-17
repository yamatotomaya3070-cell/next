/**
 * シリーズ共通スタイルガイドの型と正規化。
 *
 * このガイドは「一度だけ定義してJSONで固定保存し、以降の全生成が参照する」
 * ための単一の真実（single source of truth）。台本生成・立ち絵/背景の画像生成・
 * テロップ・サムネの全工程がこの内容を読む。独自性（模倣回避）の担保もここが起点。
 *
 * AI提案結果や、UI/DB由来の改ざんされうるペイロードを常にこの normalizeStyleGuide で
 * 通してから使うこと（coercePattern / normalizeManualSteps と同じ思想の手書き正規化）。
 */

/** HEX カラー（#RRGGBB） */
export type HexColor = string;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** 立ち絵の表情差分キー（最低4種を要件とする） */
export const STYLE_GUIDE_EXPRESSIONS = ["normal", "happy", "surprised", "thinking"] as const;
export type StyleGuideExpression = (typeof STYLE_GUIDE_EXPRESSIONS)[number];

export interface StyleGuidePalette {
  background: HexColor; // 背景のベース色
  primary: HexColor; // 立ち絵/主役の色
  accent: HexColor; // アクセント（強調・装飾）
  telopOutline: HexColor; // テロップの縁取り色
}

export interface StyleGuideCharacter {
  /** 識別子（英数字。立ち絵資産キー・シード固定の基準になる。以降の生成で不変） */
  key: string;
  name: string; // 表示名
  role: string; // 役割（例: ボケ / ツッコミ / ナレーター）
  appearance: string; // 見た目の特徴（画像生成プロンプトに使う独自デザイン記述）
  voiceProfile: string; // TTS話者マッピング用のキー（例: "speaker_a"）
  /** 画像生成のシード。同一キャラで表情のみ差し替えるため固定する */
  seed: number;
  subtitleColor: HexColor; // この話者のテロップ色（話者ごとの色分け）
}

export interface StyleGuideTelopRules {
  fontMood: string; // フォントの雰囲気（例: 丸ゴシック体・太め）
  outline: string; // 縁取りの指定（独自の装飾スタイル）
  position: string; // 表示位置（例: 画面下・中央下）
  decoration: string; // 装飾スタイル（模倣を避けた独自表現）
}

/**
 * 担当YouTuber（架空の常連クライアント）のプロフィール。
 * 建前＝「1人のYouTuberから長期的に編集を請け負う専属エディター」。
 * 毎回の依頼書をこの同一人格・同一チャンネルとして生成し、
 * 就労者に「いつものクライアントから次の仕事が来た」と感じさせる（一貫体験）。
 */
export interface StyleGuideClient {
  channelName: string; // チャンネル名（例: 「たけしの雑学ラボ」）
  clientName: string; // 依頼主の呼び名（依頼メッセージの署名に使う）
  persona: string; // 依頼主の人物像・依頼の口調（毎回同じ人格で依頼書を書くため）
  audience: string; // 主な視聴者層（台本・トーン調整に使う）
}

/** スタイルガイド本体（DBには JSONB の content として保存する） */
export interface StyleGuideContent {
  name: string; // このガイド案の名前（例: 「つなぐ・スタジオ調」）
  artStyle: string; // 画風の説明（画像生成の基調）
  negativeStyle: string; // 避ける要素（生成崩れ・既存作品の模倣回避）
  client: StyleGuideClient; // 担当YouTuber（常連クライアント）のプロフィール
  palette: StyleGuidePalette;
  characters: StyleGuideCharacter[];
  telopRules: StyleGuideTelopRules;
  thumbnail: string; // サムネイル構図ルール（独自）
  seriesVoice: string; // シリーズの「らしさ」定義（トーン・世界観）
}

export const MAX_CHARACTERS = 4;
export const MIN_CHARACTERS = 1;

const DEFAULT_PALETTE: StyleGuidePalette = {
  background: "#F4F7FB",
  primary: "#1677E8",
  accent: "#FFB020",
  telopOutline: "#1B2A4A",
};

/** 話者ごとの既定テロップ色（キャラにcolor指定が無い/不正なときの割り当て） */
const DEFAULT_SUBTITLE_COLORS: HexColor[] = ["#1677E8", "#E8536B", "#2E9E5B", "#8A5CF6"];

const DEFAULT_TELOP_RULES: StyleGuideTelopRules = {
  fontMood: "丸ゴシック体・太め",
  outline: "濃紺の太い縁取り＋薄い影",
  position: "画面下・中央",
  decoration: "角丸の帯を敷き、重要語だけアクセント色にする",
};

const DEFAULT_CLIENT: StyleGuideClient = {
  channelName: "つなぐチャンネル",
  clientName: "チャンネル運営担当",
  persona:
    "個人でチャンネルを運営する丁寧なYouTuber。毎回きさくに『いつもありがとうございます』と声をかけ、要点は具体的に指定する。",
  audience: "スマホで気軽に見る、幅広い年代の初心者層",
};

/** HEXとして妥当ならそのまま（大文字化）、不正なら fallback を返す */
export function coerceHex(value: unknown, fallback: HexColor): HexColor {
  return typeof value === "string" && HEX_RE.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback;
}

/** HEXが妥当か */
export function isHexColor(value: unknown): value is HexColor {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** 英数字とアンダースコアのみのキーに正規化（不正なら index ベースの既定キー） */
function coerceKey(value: unknown, index: number): string {
  if (typeof value === "string") {
    const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleaned) return cleaned;
  }
  return `char_${index + 1}`;
}

function coercePalette(raw: unknown): StyleGuidePalette {
  const p = (raw ?? {}) as Partial<Record<keyof StyleGuidePalette, unknown>>;
  return {
    background: coerceHex(p.background, DEFAULT_PALETTE.background),
    primary: coerceHex(p.primary, DEFAULT_PALETTE.primary),
    accent: coerceHex(p.accent, DEFAULT_PALETTE.accent),
    telopOutline: coerceHex(p.telopOutline, DEFAULT_PALETTE.telopOutline),
  };
}

function coerceClient(raw: unknown): StyleGuideClient {
  const c = (raw ?? {}) as Partial<Record<keyof StyleGuideClient, unknown>>;
  return {
    channelName: coerceString(c.channelName, DEFAULT_CLIENT.channelName),
    clientName: coerceString(c.clientName, DEFAULT_CLIENT.clientName),
    persona: coerceString(c.persona, DEFAULT_CLIENT.persona),
    audience: coerceString(c.audience, DEFAULT_CLIENT.audience),
  };
}

function coerceTelopRules(raw: unknown): StyleGuideTelopRules {
  const t = (raw ?? {}) as Partial<Record<keyof StyleGuideTelopRules, unknown>>;
  return {
    fontMood: coerceString(t.fontMood, DEFAULT_TELOP_RULES.fontMood),
    outline: coerceString(t.outline, DEFAULT_TELOP_RULES.outline),
    position: coerceString(t.position, DEFAULT_TELOP_RULES.position),
    decoration: coerceString(t.decoration, DEFAULT_TELOP_RULES.decoration),
  };
}

function coerceCharacter(raw: unknown, index: number): StyleGuideCharacter {
  const c = (raw ?? {}) as Partial<Record<keyof StyleGuideCharacter, unknown>>;
  const seedRaw = Number(c.seed);
  // シードは非負整数に固定（未指定/不正なら index から決定的に導出＝再現性を保つ）
  const seed = Number.isFinite(seedRaw) && seedRaw > 0 ? Math.floor(seedRaw) : (index + 1) * 1000 + 7;
  return {
    key: coerceKey(c.key, index),
    name: coerceString(c.name, `キャラ${index + 1}`),
    role: coerceString(c.role, index === 0 ? "進行役" : "解説役"),
    appearance: coerceString(c.appearance, "シンプルで親しみやすい、独自デザインのマスコット"),
    voiceProfile: coerceString(c.voiceProfile, `speaker_${String.fromCharCode(97 + index)}`),
    seed,
    subtitleColor: coerceHex(
      c.subtitleColor,
      DEFAULT_SUBTITLE_COLORS[index % DEFAULT_SUBTITLE_COLORS.length],
    ),
  };
}

/** キャラのkeyが重複しないよう一意化する（後勝ちで連番サフィックス） */
function dedupeCharacterKeys(characters: StyleGuideCharacter[]): StyleGuideCharacter[] {
  const seen = new Set<string>();
  return characters.map((ch) => {
    let key = ch.key;
    let n = 2;
    while (seen.has(key)) {
      key = `${ch.key}_${n}`;
      n += 1;
    }
    seen.add(key);
    return key === ch.key ? ch : { ...ch, key };
  });
}

/**
 * 任意の入力（AI提案JSON・DBのcontent・フォーム値）を妥当な StyleGuideContent に正規化する。
 * 必ず MIN_CHARACTERS..MAX_CHARACTERS 体のキャラを持ち、全HEXが妥当な状態を保証する。
 */
export function normalizeStyleGuide(raw: unknown): StyleGuideContent {
  const g = (raw ?? {}) as Partial<Record<keyof StyleGuideContent, unknown>>;

  const rawCharacters = Array.isArray(g.characters) ? g.characters : [];
  let characters = rawCharacters
    .slice(0, MAX_CHARACTERS)
    .map((c, i) => coerceCharacter(c, i));
  if (characters.length < MIN_CHARACTERS) {
    characters = [coerceCharacter(undefined, 0)];
  }
  characters = dedupeCharacterKeys(characters);

  return {
    name: coerceString(g.name, "スタイルガイド案"),
    artStyle: coerceString(
      g.artStyle,
      "やわらかいアニメ調。清潔感のあるフラットな塗りで、線は細め。",
    ),
    negativeStyle: coerceString(
      g.negativeStyle,
      "指の破綻、左右非対称、線のにじみ、既存作品やキャラクターの模倣を避ける。",
    ),
    client: coerceClient(g.client),
    palette: coercePalette(g.palette),
    characters,
    telopRules: coerceTelopRules(g.telopRules),
    thumbnail: coerceString(
      g.thumbnail,
      "左に大きくキャラ、右にタイトル帯。視認性を最優先に、要素を詰め込みすぎない。",
    ),
    seriesVoice: coerceString(
      g.seriesVoice,
      "やさしく丁寧で、初心者を置いていかない解説トーン。専門用語は必ず言い換える。",
    ),
  };
}
