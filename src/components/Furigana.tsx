import { parseFurigana, stripFurigana } from "@/lib/furigana";

interface FuriganaProps {
  text: string;
  enabled: boolean;
  className?: string;
}

/**
 * 「漢字《かんじ》」記法のテキストを、ふりがなON時は <ruby> で、
 * OFF時は漢字のみで描画する。改行は <br> に変換。
 */
export function Furigana({ text, enabled, className }: FuriganaProps) {
  const lines = text.split("\n");

  return (
    <span className={className}>
      {lines.map((line, lineIdx) => (
        <span key={lineIdx}>
          {lineIdx > 0 && <br />}
          {enabled
            ? parseFurigana(line).map((seg, i) =>
                seg.type === "ruby" ? (
                  <ruby key={i}>
                    {seg.base}
                    <rt className="text-[0.55em] text-ink-soft">
                      {seg.reading}
                    </rt>
                  </ruby>
                ) : (
                  <span key={i}>{seg.base}</span>
                ),
              )
            : stripFurigana(line)}
        </span>
      ))}
    </span>
  );
}
