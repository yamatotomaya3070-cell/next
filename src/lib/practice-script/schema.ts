/**
 * 練習用素材台本の型と正規化。
 *
 * この機能の核は「完成品」ではなく「編集前のバラバラ素材一式」を作ること。
 * 台本は次の性質を持つ:
 *  - セグメントに priority(must / optional) を付ける。
 *    must = 完成版に必ず残す本筋。optional = 就労者が「残す/切る」を自分で判断する候補。
 *    → optional のカット判断こそが編集練習の核。
 *  - must だけを残すと想定完成尺(既定10分)に、全体(must+optional)は 1.3〜1.5倍(13〜15分)になるよう配分する。
 *  - 冒頭15秒はフック(視聴維持の要)として must で構成する。
 *  - 建前は「常連YouTuber(スタイルガイドの client)からの次回動画の依頼」。
 *
 * AI生成結果・DB/フォーム由来の改ざんされうる値は必ず normalizePracticeScript を通してから使う
 * （style-guide/schema.ts の normalizeStyleGuide と同じ思想の手書き正規化）。
 */

import type { StyleGuideContent } from "@/lib/style-guide/schema";

/** セグメントの優先度。must=必ず残す本筋 / optional=残す切るを就労者が判断する候補 */
export const SEGMENT_PRIORITIES = ["must", "optional"] as const;
export type SegmentPriority = (typeof SEGMENT_PRIORITIES)[number];

/** optional セグメントが「切る候補になり得る理由」。正解データ・採点の根拠にもなる */
export const CUT_REASONS = ["filler", "tangent", "redundant", "weak", "ng"] as const;
export type CutReason = (typeof CUT_REASONS)[number];

export interface PracticeScriptSegment {
  id: string;
  order: number;
  speakerKey: string; // スタイルガイドの character.key と対応（話者の色分け・立ち絵に使う）
  text: string; // 話す内容（空文字=間・沈黙。ふりがな記法禁止）
  priority: SegmentPriority;
  /** priority=optional のときのみ、なぜ切る候補かの理由。must では null */
  cutReason: CutReason | null;
  /** このセグメントの想定尺（秒）。素材尺・完成尺の配分計算に使う */
  estimatedSeconds: number;
  /** 冒頭フック（最初の約15秒）に属するか。フックは必ず must */
  isHook: boolean;
}

/** 練習用台本本体 */
export interface GeneratedPracticeScript {
  title: string; // 案件タイトル（例:「〇〇チャンネル 第12回の編集」）
  episodeTitle: string; // その回の動画タイトル（視聴者向け）
  clientMessage: string; // 常連YouTuberからの依頼メッセージ（署名まで含む生テキスト）
  scenario: string; // 動画の設定説明（職員向け。就労者には出さない）
  targetKeepSeconds: number; // must だけを残した想定完成尺（秒）
  segments: PracticeScriptSegment[];
}

/** 台本の尺サマリー（UI表示・バランス検証に使う） */
export interface PracticeScriptStats {
  mustSeconds: number; // must セグメント合計尺
  optionalSeconds: number; // optional セグメント合計尺
  totalSeconds: number; // 全素材の合計尺
  mustCount: number;
  optionalCount: number;
  hookSeconds: number; // 冒頭フックの合計尺
}

export const MIN_SEGMENTS = 3;
export const MAX_SEGMENTS = 120;

/** フックとみなす冒頭の秒数 */
export const HOOK_WINDOW_SECONDS = 15;

/** 既定の想定完成尺（must合計の目標）: 10分 */
export const DEFAULT_TARGET_KEEP_SECONDS = 600;

/** 素材総量は完成尺の何倍を狙うか（optionalのカット判断量の目安） */
export const RAW_RATIO_MIN = 1.3;
export const RAW_RATIO_MAX = 1.5;

/** 日本語のおおよその発話速度（1秒あたり文字数）。text長からの尺推定に使う */
const CHARS_PER_SECOND = 7;
const MIN_SEGMENT_SECONDS = 1;
const MAX_SEGMENT_SECONDS = 120;

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** text はそのまま（trim のみ）。空文字（間・沈黙）は許容する */
function coerceText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coercePriority(value: unknown): SegmentPriority {
  // 不明な値は「残す(must)」に倒す＝取り込み過ぎで壊れるより安全（切りすぎを誘発しない）
  return value === "optional" ? "optional" : "must";
}

function coerceCutReason(value: unknown, priority: SegmentPriority): CutReason | null {
  if (priority !== "optional") return null; // must に理由は付けない
  return (CUT_REASONS as readonly string[]).includes(value as string)
    ? (value as CutReason)
    : "weak";
}

/** 想定尺を秒に正規化。未指定/不正なら text 長から推定（空文字=間は既定2秒） */
function coerceSeconds(value: unknown, text: string): number {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(MAX_SEGMENT_SECONDS, Math.max(MIN_SEGMENT_SECONDS, Math.round(n)));
  }
  if (!text) return 2; // 無音セグメントの既定
  const estimated = Math.round(text.length / CHARS_PER_SECOND);
  return Math.min(MAX_SEGMENT_SECONDS, Math.max(MIN_SEGMENT_SECONDS, estimated));
}

function coerceSegment(
  raw: unknown,
  index: number,
  validSpeakerKeys: string[],
): PracticeScriptSegment {
  const s = (raw ?? {}) as Partial<Record<keyof PracticeScriptSegment, unknown>>;
  const text = coerceText(s.text);
  const priority = coercePriority(s.priority);
  const speakerRaw = coerceString(s.speakerKey, validSpeakerKeys[0]);
  // 話者キーはスタイルガイドのキャラに存在するものだけ許可（無ければ先頭キャラ）
  const speakerKey = validSpeakerKeys.includes(speakerRaw) ? speakerRaw : validSpeakerKeys[0];
  return {
    id: coerceString(s.id, `seg_${index + 1}`),
    order: index + 1,
    speakerKey,
    text,
    priority,
    cutReason: coerceCutReason(s.cutReason, priority),
    estimatedSeconds: coerceSeconds(s.estimatedSeconds, text),
    isHook: s.isHook === true,
  };
}

/** id が重複しないよう一意化（後勝ちで連番サフィックス） */
function dedupeIds(segments: PracticeScriptSegment[]): PracticeScriptSegment[] {
  const seen = new Set<string>();
  return segments.map((seg) => {
    let id = seg.id;
    let n = 2;
    while (seen.has(id)) {
      id = `${seg.id}_${n}`;
      n += 1;
    }
    seen.add(id);
    return id === seg.id ? seg : { ...seg, id };
  });
}

/**
 * 冒頭フックの整合を取る:
 *  - HOOK_WINDOW_SECONDS 以内に収まるセグメント（＝終端が窓内）を isHook=true にする。
 *    先頭セグメントは、単体で窓を超えても必ずフックとみなす。
 *  - フックは必ず must（optional のフックは矛盾するので must に昇格）。
 *  - フック域を過ぎたら isHook=false に統一する。
 */
function reconcileHook(segments: PracticeScriptSegment[]): PracticeScriptSegment[] {
  let elapsed = 0;
  return segments.map((seg, index) => {
    const endSec = elapsed + seg.estimatedSeconds;
    const isHookNow = index === 0 || endSec <= HOOK_WINDOW_SECONDS;
    elapsed = endSec;
    if (isHookNow) {
      return seg.priority === "must" && seg.isHook
        ? seg
        : { ...seg, priority: "must" as const, cutReason: null, isHook: true };
    }
    return seg.isHook ? { ...seg, isHook: false } : seg;
  });
}

function fallbackSegments(validSpeakerKeys: string[]): PracticeScriptSegment[] {
  const a = validSpeakerKeys[0];
  const b = validSpeakerKeys[1] ?? validSpeakerKeys[0];
  return [
    coerceSegment(
      { text: "きょうのテーマは、はじめての人にもわかる内容です。", priority: "must", speakerKey: a, isHook: true, estimatedSeconds: 8 },
      0,
      validSpeakerKeys,
    ),
    coerceSegment(
      { text: "さっそく本題に入っていきましょう。", priority: "must", speakerKey: b, estimatedSeconds: 6 },
      1,
      validSpeakerKeys,
    ),
    coerceSegment(
      { text: "えーっと、これはちょっと関係ない雑談ですが……", priority: "optional", cutReason: "tangent", speakerKey: a, estimatedSeconds: 10 },
      2,
      validSpeakerKeys,
    ),
  ];
}

/**
 * 任意の入力（AI提案JSON・DB値・フォーム値）を妥当な GeneratedPracticeScript に正規化する。
 * スタイルガイドの話者キーに紐付け、フック整合・尺推定・id一意化まで保証する。
 */
export function normalizePracticeScript(
  raw: unknown,
  styleGuide: StyleGuideContent,
  targetKeepSeconds: number = DEFAULT_TARGET_KEEP_SECONDS,
): GeneratedPracticeScript {
  const g = (raw ?? {}) as Partial<Record<keyof GeneratedPracticeScript, unknown>>;
  const validSpeakerKeys = styleGuide.characters.map((c) => c.key);

  const rawSegments = Array.isArray(g.segments) ? g.segments : [];
  let segments = rawSegments
    .slice(0, MAX_SEGMENTS)
    .map((s, i) => coerceSegment(s, i, validSpeakerKeys));
  if (segments.length < MIN_SEGMENTS) {
    segments = fallbackSegments(validSpeakerKeys);
  }
  segments = dedupeIds(segments);
  segments = reconcileHook(segments);
  // order を最終的な並び順で振り直す（フック整合で並びは変えていないが保険）
  segments = segments.map((seg, i) => (seg.order === i + 1 ? seg : { ...seg, order: i + 1 }));

  const target =
    Number.isFinite(targetKeepSeconds) && targetKeepSeconds > 0
      ? Math.round(targetKeepSeconds)
      : DEFAULT_TARGET_KEEP_SECONDS;

  return {
    title: coerceString(g.title, `${styleGuide.client.channelName} 次回動画の編集`),
    episodeTitle: coerceString(g.episodeTitle, "次回のテーマ"),
    clientMessage: coerceString(
      g.clientMessage,
      `いつもありがとうございます。次回の動画の編集をお願いします。よろしくお願いします。\n${styleGuide.client.clientName}`,
    ),
    scenario: coerceString(g.scenario, "架空の常連クライアントからの通常依頼。"),
    targetKeepSeconds: target,
    segments,
  };
}

/** must/optional/フックの尺サマリーを算出する（純粋関数） */
export function practiceScriptStats(script: GeneratedPracticeScript): PracticeScriptStats {
  let mustSeconds = 0;
  let optionalSeconds = 0;
  let mustCount = 0;
  let optionalCount = 0;
  let hookSeconds = 0;
  for (const seg of script.segments) {
    if (seg.priority === "must") {
      mustSeconds += seg.estimatedSeconds;
      mustCount += 1;
    } else {
      optionalSeconds += seg.estimatedSeconds;
      optionalCount += 1;
    }
    if (seg.isHook) hookSeconds += seg.estimatedSeconds;
  }
  return {
    mustSeconds,
    optionalSeconds,
    totalSeconds: mustSeconds + optionalSeconds,
    mustCount,
    optionalCount,
    hookSeconds,
  };
}

/**
 * 台本のバランス警告（職員プレビュー用）。生成をブロックはしない＝あくまで気づき。
 * must が目標尺から大きく外れる／総量が完成尺の1.3〜1.5倍に収まらない／optionalが無い等を指摘。
 */
export function validatePracticeScriptBalance(script: GeneratedPracticeScript): string[] {
  const stats = practiceScriptStats(script);
  const warnings: string[] = [];
  const target = script.targetKeepSeconds;

  const mustLow = target * 0.8;
  const mustHigh = target * 1.2;
  if (stats.mustSeconds < mustLow || stats.mustSeconds > mustHigh) {
    warnings.push(
      `必ず残す(must)の合計が約${Math.round(stats.mustSeconds / 60)}分で、目標の約${Math.round(
        target / 60,
      )}分から離れています。`,
    );
  }
  if (stats.optionalCount === 0) {
    warnings.push("切る候補(optional)がありません。編集判断の練習になりません。");
  }
  const ratio = target > 0 ? stats.totalSeconds / target : 0;
  if (ratio < RAW_RATIO_MIN || ratio > RAW_RATIO_MAX) {
    warnings.push(
      `素材の総量が完成尺の約${ratio.toFixed(1)}倍です（目安は${RAW_RATIO_MIN}〜${RAW_RATIO_MAX}倍）。`,
    );
  }
  if (stats.hookSeconds === 0) {
    warnings.push("冒頭のフックがありません。");
  }
  return warnings;
}
