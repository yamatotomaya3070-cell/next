/**
 * DaVinci Resolve の操作辞典（1項目＝1操作）。
 *
 * 依頼書に「○○してください」と書かれていて「○○ってどうするの？」となったとき、
 * ○○で検索して引けるようにする。絆の案件に限らず、一般的な動画編集の依頼で出てくる言葉を集める。
 * プリセット（絆_型・絆_YouTube_720p など）は近道として紹介し、手順はプリセットが無くても
 * できる書き方にする。画面の名前は DaVinci Resolve 21 の日本語表示に合わせる。
 * 確かめられなかった操作は書かない。
 *
 * データは ops/ の下に、画面の部分ごとに分けて置く。
 */
import type { GuideStep } from "./chapters";
import type { SearchableOperation } from "./opsSearch";
import { OPS_BASICS } from "./ops/basics";
import { OPS_MEDIA } from "./ops/media";
import { OPS_TIMELINE } from "./ops/timeline";
import { OPS_LOOK } from "./ops/look";
import { OPS_TEXT } from "./ops/text";
import { OPS_EFFECTS } from "./ops/effects";
import { OPS_AUDIO } from "./ops/audio";
import { OPS_EXPORT } from "./ops/export";
import { OPS_TROUBLE } from "./ops/trouble";

export type OpCategoryId =
  | "basics"
  | "media"
  | "timeline"
  | "look"
  | "text"
  | "effects"
  | "audio"
  | "export"
  | "trouble";

export interface OpCategory {
  id: OpCategoryId;
  title: string;
  summary: string;
}

/** 辞典の並び順（画面の部分ごと） */
export const OP_CATEGORIES: OpCategory[] = [
  { id: "basics", title: "画面の基本・再生・保存", summary: "ページの切りかえ、再生、もどす、保存" },
  { id: "media", title: "メディアプール（素材の置き場）", summary: "素材を入れる、探す、整理する" },
  { id: "timeline", title: "タイムライン（並べる・切る・つめる）", summary: "置く、切る、消す、動かす、長さを変える" },
  { id: "look", title: "インスペクタ（映像の見た目）", summary: "大きさ、位置、切り抜き、うすくする、速さ" },
  { id: "text", title: "文字（字幕・テロップ）", summary: "文字を置く、見た目を変える、増やす" },
  { id: "effects", title: "エフェクト・トランジション", summary: "場面のつなぎ目、フェード、動き" },
  { id: "audio", title: "音（声・BGM・効果音）", summary: "音量、BGM、フェード、ミュート" },
  { id: "export", title: "書き出し（デリバー）", summary: "MP4 にする、設定を自分で決める" },
  { id: "trouble", title: "こまったとき", summary: "動かない、消えた、見つからない" },
];

export interface GuideOperation extends SearchableOperation {
  category: OpCategoryId;
  /** 操作の名前（例：「映像をフェードイン・フェードアウトさせる」） */
  title: string;
  /** 別の言い方・検索語（依頼書に出てくる言葉、ひらがなの読み など） */
  aliases: string[];
  /** 画面のどこでやるか */
  where: {
    /** ページ名：メディア／カット／エディット／Fusion／カラー／Fairlight／デリバー（ページに関係なければ「どのページでも」など） */
    page: string;
    /** パネル名：メディアプール／タイムライン／インスペクタ／エフェクト／ビューア／上のメニュー 等 */
    panel: string;
    /** ボタン・項目の場所 */
    button?: string;
  };
  /** これで何ができるか */
  what: string;
  /** 手順（1手1行） */
  steps: GuideStep[];
  /** うまくいかないとき */
  trouble?: string[];
  /** 関連する操作の id */
  related?: string[];
  /** 写真つきで説明している教科書の節 "章slug#節id" */
  chapterRef?: string;
  /** プリセット（設定済みの型）を使う近道があるときの説明 */
  shortcut?: string;
}

export const GUIDE_OPERATIONS: GuideOperation[] = [
  ...OPS_BASICS,
  ...OPS_MEDIA,
  ...OPS_TIMELINE,
  ...OPS_LOOK,
  ...OPS_TEXT,
  ...OPS_EFFECTS,
  ...OPS_AUDIO,
  ...OPS_EXPORT,
  ...OPS_TROUBLE,
];

export function getOperation(id: string): GuideOperation | undefined {
  return GUIDE_OPERATIONS.find((op) => op.id === id);
}

export function getOperationsByCategory(category: OpCategoryId): GuideOperation[] {
  return GUIDE_OPERATIONS.filter((op) => op.category === category);
}

/** 操作の詳細ページの URL（basePath は "/guide" や "/staff/guide"） */
export function operationHref(basePath: string, id: string): string {
  return `${basePath}/ops/${id}`;
}

/** 検索窓の下に出す「よく調べる言葉」 */
export const POPULAR_SEARCH_WORDS = [
  "カット",
  "フェード",
  "テロップ",
  "字幕",
  "BGM",
  "音量",
  "ズーム",
  "トランジション",
  "書き出し",
  "もどす",
];
