// VideoProject(JSON) → 納品仕様書(.md) ＋ シーンデータ(.csv)。トラックA(クライアント向け一式)の成果物。
//   使い方: npx tsx scripts/scene/emit-spec.ts [project.json] [outDir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildVideoSpec, videoSpecToMarkdown } from "../../src/lib/scene/spec";
import { normalizeVideoProject } from "../../src/lib/scene/schema";

const PROJECT = process.argv[2] || "poc/scene/out/newnisa_project.json";
const OUT = process.argv[3] || "poc/scene/out";
mkdirSync(OUT, { recursive: true });

const raw = JSON.parse(readFileSync(PROJECT, "utf8"));
const project = normalizeVideoProject(raw, raw.theme);
const spec = buildVideoSpec(project);

// 仕様書 Markdown
const md = videoSpecToMarkdown(spec);
writeFileSync(`${OUT}/spec.md`, md);

// シーンデータ CSV（Excelで開ける・BOM付きUTF-8）
const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const rows = [["No", "section", "映像タイプ", "テロップ", "話者", "セリフ", "強調", "編集指示", "使用素材", "品質チェック", "出典"]];
for (const s of spec.scenes) {
  if (s.lines.length === 0) {
    rows.push([`${s.no}`, s.section, s.visualType, s.onScreenText.join(" / "), "", "", "", s.editing, s.assets.join(" / "), s.checks.join(" / "), s.source?.ref ?? ""]);
  }
  s.lines.forEach((ln, i) => {
    rows.push([
      i === 0 ? `${s.no}` : "", i === 0 ? s.section : "", i === 0 ? s.visualType : "", i === 0 ? s.onScreenText.join(" / ") : "",
      ln.speaker, ln.text, ln.emphasis.join("・"),
      i === 0 ? s.editing : "", i === 0 ? s.assets.join(" / ") : "", i === 0 ? s.checks.join(" / ") : "", i === 0 ? (s.source?.ref ?? "") : "",
    ]);
  });
}
const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
writeFileSync(`${OUT}/scenes.csv`, csv);

// JSON(データ)はそのまま添付できるよう整形コピー
writeFileSync(`${OUT}/data.json`, JSON.stringify(project, null, 2));

console.log(`仕様書: ${OUT}/spec.md (${md.split("\n").length}行)`);
console.log(`データ: ${OUT}/scenes.csv (${rows.length - 1}行) / data.json`);
console.log(`\n--- 仕様書プレビュー(先頭) ---\n${md.split("\n").slice(0, 20).join("\n")}`);
