/**
 * 操作辞典のあいまい検索。
 *
 * 依頼書の「○○してください」をそのまま貼っても引けるように、
 * ひらがな／カタカナ、全角／半角、大文字／小文字、空白や記号のちがい、
 * 「してください」「のやり方」などの言い回しを吸収してから照合する。
 * サーバーでもブラウザでも動く純粋な関数だけを置く。
 */

/** 検索の対象にする操作の情報（operations.ts の GuideOperation の一部） */
export interface SearchableOperation {
  id: string;
  title: string;
  aliases: string[];
  what: string;
  where: { page: string; panel: string; button?: string };
  steps: { text: string; hint?: string }[];
  trouble?: string[];
}

export interface OperationHit<T extends SearchableOperation = SearchableOperation> {
  op: T;
  score: number;
}

// 依頼書や質問によく付く言い回し。長いものから順に外す。
const REQUEST_SUFFIXES = [
  "してもらえますか",
  "してください",
  "してほしい",
  "させてください",
  "のしかた",
  "の仕方",
  "のやりかた",
  "のやり方",
  "のほうほう",
  "の方法",
  "やり方",
  "仕方",
  "方法",
  "下さい",
  "ってなに",
  "ってどうするの",
  "ってどうやるの",
  "どうするの",
  "どうやるの",
  "どうやって",
  "やりかた",
  "しかた",
  "ほうほう",
  "したい",
  "させる",
  "します",
  "しない",
  "とは",
  "する",
  "して",
  "ください",
].sort((a, b) => b.length - a.length);

// 意味を持たない記号と空白（長音「ー」は意味があるので残す）
const IGNORED_CHARS = /[\s・、。,.!?！？「」『』（）()［］[\]【】〈〉<>"'“”‘’:：;；/／\\|~〜～\-＿_+＋*＊#＃]/g;

/** カタカナをひらがなにする（ヴ・ヵ・ヶ も含む） */
function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * 照合用の形にそろえる。
 * 全角英数→半角（NFKC）、半角カナ→全角（NFKC）、カタカナ→ひらがな、小文字化、空白と記号を除く。
 */
export function normalizeForSearch(input: string): string {
  return katakanaToHiragana(normalizeWidth(input));
}

/** 全角・半角と大文字・小文字をそろえ、空白と記号を除く（カタカナはそのまま） */
function normalizeWidth(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(IGNORED_CHARS, "");
}

/**
 * 「フェードしてください」→「フェード」のように、言い回しを外す。
 * カタカナをひらがなにする前の文字に使う（「カット」の「ト」を助詞と取りちがえないため）。
 */
export function stripRequestPhrase(text: string): string {
  let s = text;
  // 2回まで外す（例：「のやりかたをおしえてください」は対象外だが「してください」は外れる）
  for (let i = 0; i < 2; i++) {
    const suffix = REQUEST_SUFFIXES.find((x) => s.endsWith(x) && s.length > x.length);
    if (!suffix) break;
    s = s.slice(0, -suffix.length);
  }
  // 末尾に残りやすい助詞を1つだけ外す（「音量を」「BGMに」）
  if (s.length > 2) s = s.replace(/[をにがはでへともの]$/, "");
  return s;
}

/**
 * 入力を検索語に分ける。空白（全角含む）と、助詞の「を」で区切る。
 * 「テロップを入れてください」→「てろっぷ」「入れて」
 */
export function toSearchTerms(query: string): string[] {
  return query
    .normalize("NFKC")
    .split(/\s+/)
    .flatMap((w) => stripRequestPhrase(normalizeWidth(w)).split("を"))
    .map((w) => katakanaToHiragana(stripRequestPhrase(w)))
    .filter((w) => w.length > 0);
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  if (s.length === 1) out.add(s);
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** 2文字ずつの重なりの割合（0〜1）。語の一部がちがうときの「だいたい合っている」を拾う */
export function bigramSimilarity(term: string, target: string): number {
  if (!term || !target) return 0;
  const a = bigrams(term);
  const b = bigrams(target);
  let shared = 0;
  for (const g of a) if (b.has(g)) shared += 1;
  return shared / a.size;
}

interface PreparedOperation<T extends SearchableOperation> {
  op: T;
  title: string;
  aliases: string[];
  where: string;
  body: string;
}

function prepare<T extends SearchableOperation>(op: T): PreparedOperation<T> {
  return {
    op,
    title: normalizeForSearch(op.title),
    aliases: op.aliases.map(normalizeForSearch),
    where: normalizeForSearch([op.where.page, op.where.panel, op.where.button ?? ""].join(" ")),
    body: normalizeForSearch(
      [op.what, ...op.steps.map((s) => `${s.text} ${s.hint ?? ""}`), ...(op.trouble ?? [])].join(" "),
    ),
  };
}

// 点数の重み。名前や別の言い方に当たったものを、本文に出てくるだけのものより上にする。
const SCORE = {
  titleExact: 100,
  aliasExact: 90,
  titleIncludes: 60,
  aliasIncludes: 50,
  where: 20,
  body: 10,
  fuzzyMax: 30,
} as const;

/** 類似とみなす下限（2文字ずつの重なりが 6 割以上） */
const FUZZY_THRESHOLD = 0.6;

function scoreTerm<T extends SearchableOperation>(p: PreparedOperation<T>, term: string): number {
  if (p.title === term) return SCORE.titleExact;
  if (p.aliases.includes(term)) return SCORE.aliasExact;
  if (p.title.includes(term)) return SCORE.titleIncludes;
  if (p.aliases.some((a) => a.includes(term))) return SCORE.aliasIncludes;
  if (p.where.includes(term)) return SCORE.where;
  if (p.body.includes(term)) return SCORE.body;
  // 1文字の語は、あいまい一致にすると何にでも当たるので使わない
  if (term.length < 2) return 0;
  const best = Math.max(
    bigramSimilarity(term, p.title),
    ...p.aliases.map((a) => bigramSimilarity(term, a)),
  );
  return best >= FUZZY_THRESHOLD ? Math.round(best * SCORE.fuzzyMax) : 0;
}

/**
 * 操作を探す。すべての検索語に当たったものを、点数の高い順に返す。
 * すべてに当たるものが無いときは、いちばん多くの語に当たったものを返す
 * （「音量を下げる」の「下げる」のように、手順に書いていない動詞があっても引けるように）。
 * 語が無いときは空の配列。
 */
export function searchOperations<T extends SearchableOperation>(
  ops: readonly T[],
  query: string,
  limit = 20,
): OperationHit<T>[] {
  const terms = toSearchTerms(query);
  if (terms.length === 0) return [];

  const scored = ops.map((op) => {
    const p = prepare(op);
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const s = scoreTerm(p, term);
      if (s > 0) {
        matched += 1;
        score += s;
      }
    }
    return { op, score, matched };
  });

  const best = Math.max(0, ...scored.map((x) => x.matched));
  if (best === 0) return [];

  return scored
    .filter((x) => x.matched === best)
    .map(({ op, score }): OperationHit<T> => ({ op, score }))
    .sort((a, b) => b.score - a.score || a.op.title.length - b.op.title.length)
    .slice(0, limit);
}
