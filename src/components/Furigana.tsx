import { stripFurigana } from "@/lib/furigana";

interface FuriganaProps {
  text: string;
  className?: string;
}

/**
 * テキストを表示する。ふりがな機能は廃止したため、旧データに残る
 * 「漢字《かんじ》」記法は読みを取り除いて漢字だけで描画する。改行は <br> に変換。
 */
export function Furigana({ text, className }: FuriganaProps) {
  const lines = stripFurigana(text).split("\n");

  return (
    <span className={className}>
      {lines.map((line, lineIdx) => (
        <span key={lineIdx}>
          {lineIdx > 0 && <br />}
          {line}
        </span>
      ))}
    </span>
  );
}
