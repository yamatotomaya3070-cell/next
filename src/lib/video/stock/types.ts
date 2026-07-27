/**
 * ストック動画プロバイダの共通型（プロバイダ非依存）。
 *
 * 実写素材のリアル化に使う。Pexels を初期実装とするが、Pixabay 等を追加しても
 * パイプライン側は StockProvider インターフェイスだけに依存させ、差し替え可能にする。
 *
 * ライセンス上、取得クリップには撮影者名・提供元URLのクレジットが必要なため、
 * StockClip はメタデータとして photographer / sourceUrl を必ず保持する。
 */

export type StockOrientation = "landscape" | "portrait" | "square";

export interface StockSearchOptions {
  /** 取得件数（既定はプロバイダ実装のデフォルト） */
  perPage?: number;
  /** 縦横の向き。テンプレートのアスペクト比に合わせて指定する */
  orientation?: StockOrientation;
  /** この秒数以上のクリップのみ返す（短すぎる素材を除外） */
  minDurationSec?: number;
  /** この秒数以下のクリップのみ返す */
  maxDurationSec?: number;
  /** ページ番号（1始まり） */
  page?: number;
}

/** 1クリップの中の1レンディション（解像度違いのダウンロードURL） */
export interface StockVideoFile {
  quality: string; // "hd" | "sd" | "uhd" など
  width: number | null;
  height: number | null;
  fileType: string; // "video/mp4" など
  link: string; // 直接ダウンロード可能なURL
}

/** 検索で得られる1クリップ（メタデータ＋レンディション一覧） */
export interface StockClip {
  provider: string; // "pexels" など
  id: string;
  width: number;
  height: number;
  durationSec: number;
  photographer: string; // クレジット表示用の作者名
  photographerUrl: string; // 作者プロフィールURL
  sourceUrl: string; // 提供元のクリップページURL
  previewImageUrl: string | null;
  files: StockVideoFile[];
}

export interface StockProvider {
  readonly name: string;
  /** キーワードで動画クリップを検索する */
  searchVideos(query: string, options?: StockSearchOptions): Promise<StockClip[]>;
}

/**
 * 目標解像度に最も近いmp4レンディションを選ぶ。
 * アスペクト比が近いものを優先し、その中で幅が目標に最も近いものを返す。
 * 適切なmp4が無ければ null。
 */
export function pickVideoFile(
  clip: StockClip,
  targetWidth: number,
  targetHeight: number,
): StockVideoFile | null {
  const targetAspect = targetWidth / targetHeight;
  const mp4s = clip.files.filter(
    (f) => f.fileType.includes("mp4") && f.width && f.height && f.link,
  );
  if (mp4s.length === 0) return null;

  const scored = mp4s
    .map((f) => {
      const aspect = (f.width as number) / (f.height as number);
      const aspectDiff = Math.abs(aspect - targetAspect);
      const widthDiff = Math.abs((f.width as number) - targetWidth);
      return { file: f, aspectDiff, widthDiff };
    })
    // アスペクト差を最優先（0.1未満を同等とみなす）、次に幅の近さ
    .sort((a, b) => {
      if (Math.abs(a.aspectDiff - b.aspectDiff) > 0.1) return a.aspectDiff - b.aspectDiff;
      return a.widthDiff - b.widthDiff;
    });

  return scored[0].file;
}

/** ライセンス表記用のクレジット行を作る（例: "Jane Doe / Pexels (https://...)"） */
export function creditLine(clip: StockClip): string {
  const providerLabel = clip.provider.charAt(0).toUpperCase() + clip.provider.slice(1);
  return `${clip.photographer} / ${providerLabel} (${clip.sourceUrl})`;
}
