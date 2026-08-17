import { stripFurigana } from "@/lib/furigana";

interface MarkdownLiteProps {
  text: string;
  /** 先頭の見出しがこの文字列と一致する場合は省く（カード見出しとの二重表示を避ける） */
  omitLeadingHeading?: string;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "paragraph"; lines: string[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*・]\s+(.*)$/;
const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSeparatorRow = (cells: string[]) =>
  cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

/** 依頼書などの軽いMarkdown（見出し/箇条書き/表）を、ふりがな記法を除去して表示する。 */
function parseBlocks(src: string): Block[] {
  const lines = stripFurigana(src).split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(lines[i].match(BULLET)![1].trim());
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = splitCells(lines[i]);
        if (!isSeparatorRow(cells)) rows.push(cells);
        i++;
      }
      if (rows.length) {
        const [header, ...body] = rows;
        blocks.push({ type: "table", header, rows: body });
      }
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", lines: para });
  }
  return blocks;
}

export function MarkdownLite({ text, omitLeadingHeading }: MarkdownLiteProps) {
  let blocks = parseBlocks(text);
  const first = blocks[0];
  if (
    omitLeadingHeading &&
    first?.type === "heading" &&
    first.text.trim() === omitLeadingHeading.trim()
  ) {
    blocks = blocks.slice(1);
  }
  return (
    <div className="space-y-3 text-[16px] leading-loose text-ink">
      {blocks.map((b, idx) => {
        if (b.type === "heading") {
          const size = b.level <= 1 ? "text-xl" : b.level === 2 ? "text-lg" : "text-base";
          return (
            <h4 key={idx} className={`${size} font-bold text-ink ${idx === 0 ? "" : "mt-4"}`}>
              {b.text}
            </h4>
          );
        }
        if (b.type === "list") {
          return (
            <ul key={idx} className="list-disc space-y-1 pl-6">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "table") {
          return (
            <div key={idx} className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr>
                    {b.header.map((h, j) => (
                      <th key={j} className="border border-line bg-primary-soft px-3 py-2 text-left font-bold text-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((c, j) => (
                        <td key={j} className="border border-line px-3 py-2 align-top text-ink">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={idx} className="leading-loose">
            {b.lines.map((ln, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {ln}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
