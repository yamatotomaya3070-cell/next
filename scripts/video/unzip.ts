/**
 * ZIP の読み出し（Node 標準の zlib だけで書く。外部依存なし）。
 *
 * 支給素材一式.zip から、セリフ音声(wav)だけを取り出すために使う。
 * central directory を末尾から辿り、stored(0) / deflate(8) の2方式に対応する。
 * zip64（4GB超）は対象外。
 */
import { inflateRawSync } from "node:zlib";

export interface ZipEntry {
  /** ZIP 内のパス（"/" 区切り） */
  name: string;
  data: Buffer;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

function findEocd(zip: Buffer): number {
  // コメントは最大 65535 バイト。末尾からその範囲だけ探す
  const minPos = Math.max(0, zip.length - 22 - 65535);
  for (let pos = zip.length - 22; pos >= minPos; pos--) {
    if (zip.readUInt32LE(pos) === EOCD_SIG) return pos;
  }
  throw new Error("ZIP の終端レコードが見つかりません（壊れているか ZIP ではありません）");
}

/**
 * ZIP 内のエントリを列挙する。filter を渡すと、条件を満たすものだけ展開する
 * （音声だけ欲しいときに、映像まで展開してメモリを使わないため）。
 */
export function readZipEntries(zip: Buffer, filter?: (name: string) => boolean): ZipEntry[] {
  const eocd = findEocd(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  let pos = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(pos) !== CENTRAL_SIG) {
      throw new Error(`ZIP の central directory が壊れています（entry ${i}）`);
    }
    const method = zip.readUInt16LE(pos + 10);
    const compSize = zip.readUInt32LE(pos + 20);
    const uncompSize = zip.readUInt32LE(pos + 24);
    const nameLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const commentLen = zip.readUInt16LE(pos + 32);
    const localOffset = zip.readUInt32LE(pos + 42);
    const name = zip.subarray(pos + 46, pos + 46 + nameLen).toString("utf8").replace(/\\/g, "/");
    pos += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue; // フォルダ
    if (filter && !filter(name)) continue;

    if (zip.readUInt32LE(localOffset) !== LOCAL_SIG) {
      throw new Error(`ZIP のローカルヘッダが壊れています: ${name}`);
    }
    const localNameLen = zip.readUInt16LE(localOffset + 26);
    const localExtraLen = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = zip.subarray(dataStart, dataStart + compSize);

    let data: Buffer;
    if (method === METHOD_STORED) data = Buffer.from(raw);
    else if (method === METHOD_DEFLATE) data = inflateRawSync(raw);
    else throw new Error(`対応していない圧縮方式 (${method}): ${name}`);

    if (data.length !== uncompSize) {
      throw new Error(`展開後のサイズが合いません: ${name}（${data.length} ≠ ${uncompSize}）`);
    }
    entries.push({ name, data });
  }
  return entries;
}
