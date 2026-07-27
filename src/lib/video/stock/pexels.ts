/**
 * Pexels 動画検索の StockProvider 実装。
 * API: https://api.pexels.com/videos/search （Authorization ヘッダにAPIキー）
 * ライセンス: 商用可・改変可・帰属不要だが、API利用時はPexelsと撮影者のクレジットが求められる
 *            （StockClip.photographer / sourceUrl に保持し、素材ZIPへ credits を同梱する）。
 */
import type {
  StockClip,
  StockProvider,
  StockSearchOptions,
  StockVideoFile,
} from "./types";

const PEXELS_SEARCH_API = "https://api.pexels.com/videos/search";
const PEXELS_TIMEOUT_MS = 30_000;

interface PexelsVideoFile {
  quality?: string;
  width?: number | null;
  height?: number | null;
  file_type?: string;
  link?: string;
}

interface PexelsVideo {
  id?: number;
  width?: number;
  height?: number;
  duration?: number;
  url?: string;
  image?: string;
  user?: { name?: string; url?: string };
  video_files?: PexelsVideoFile[];
}

function mapVideo(v: PexelsVideo): StockClip {
  const files: StockVideoFile[] = (v.video_files ?? [])
    .filter((f) => Boolean(f.link))
    .map((f) => ({
      quality: f.quality ?? "unknown",
      width: f.width ?? null,
      height: f.height ?? null,
      fileType: f.file_type ?? "video/mp4",
      link: f.link as string,
    }));

  return {
    provider: "pexels",
    id: String(v.id ?? ""),
    width: v.width ?? 0,
    height: v.height ?? 0,
    durationSec: v.duration ?? 0,
    photographer: v.user?.name ?? "Unknown",
    photographerUrl: v.user?.url ?? "",
    sourceUrl: v.url ?? "",
    previewImageUrl: v.image ?? null,
    files,
  };
}

export function createPexelsProvider(apiKey: string): StockProvider {
  return {
    name: "pexels",

    async searchVideos(
      query: string,
      options: StockSearchOptions = {},
    ): Promise<StockClip[]> {
      const params = new URLSearchParams({
        query,
        per_page: String(options.perPage ?? 15),
        page: String(options.page ?? 1),
      });
      if (options.orientation) params.set("orientation", options.orientation);

      const res = await fetch(`${PEXELS_SEARCH_API}?${params.toString()}`, {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(PEXELS_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(
          `Pexels API エラー (${res.status}): ${(await res.text()).slice(0, 300)}`,
        );
      }
      const data = (await res.json()) as { videos?: PexelsVideo[] };

      let clips = (data.videos ?? []).map(mapVideo).filter((c) => c.files.length > 0);
      if (options.minDurationSec != null) {
        clips = clips.filter((c) => c.durationSec >= (options.minDurationSec as number));
      }
      if (options.maxDurationSec != null) {
        clips = clips.filter((c) => c.durationSec <= (options.maxDurationSec as number));
      }
      return clips;
    },
  };
}
