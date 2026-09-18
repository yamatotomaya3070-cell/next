// フォルダやファイルを ZIP にまとめる（Node 標準の zlib だけで書く）。
//
// Windows PowerShell 5.1 の Compress-Archive は区切りに "\" を使うため、Mac では
// フォルダが崩れる。tar.exe は日本語名を Shift-JIS で書くので、Mac や英語版 Windows で化ける。
// ここでは ZIP の決まりどおり区切りを "/"、名前を UTF-8（汎用フラグ bit11 付き）で書き、
// どの OS で展開しても日本語のファイル名とフォルダがそのまま出るようにする。
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

interface Entry {
  name: string; // ZIP 内のパス（"/" 区切り）
  data: Buffer;
  mtime: Date;
}

const UTF8_FLAG = 0x0800;
const DEFLATE = 8;

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function collect(baseDir: string, target: string, out: Entry[]) {
  const full = join(baseDir, target);
  const st = statSync(full);
  if (st.isDirectory()) {
    for (const child of readdirSync(full).sort()) collect(baseDir, join(target, child), out);
    return;
  }
  out.push({
    name: relative(baseDir, full).split(sep).join("/"),
    data: readFileSync(full),
    mtime: st.mtime,
  });
}

/**
 * baseDir から見た paths（ファイルかフォルダ）を outFile の ZIP にまとめる。
 * paths に無いものは含めない。存在しない path はエラーにする（入れ忘れに気づけるように）。
 */
export function zipPaths(baseDir: string, paths: string[], outFile: string): void {
  const entries: Entry[] = [];
  for (const p of paths) collect(baseDir, p, entries);

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const compressed = deflateRawSync(e.data);
    const crc = crc32(e.data);
    const { time, date } = dosTime(e.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(DEFLATE, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(DEFLATE, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  writeFileSync(outFile, Buffer.concat([...locals, ...centrals, end]));
}
