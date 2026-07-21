// ふりがな記法「漢字《かんじ》」のパース/除去ユーティリティ

const FURIGANA_PATTERN = /([一-鿿々〆々]+)《(.+?)》/g;

export interface FuriganaSegment {
  type: "plain" | "ruby";
  base: string;
  reading?: string;
}

/** テキストをふりがなセグメントに分解する */
export function parseFurigana(text: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(FURIGANA_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "plain", base: text.slice(lastIndex, index) });
    }
    segments.push({ type: "ruby", base: match[1], reading: match[2] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "plain", base: text.slice(lastIndex) });
  }
  return segments;
}

/** ふりがな記法を取り除き、漢字だけのテキストにする（読み上げ・ふりがなOFF用） */
export function stripFurigana(text: string): string {
  return text.replace(FURIGANA_PATTERN, "$1");
}
