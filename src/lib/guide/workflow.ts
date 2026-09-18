/**
 * 動画編集の作業の流れ（全案件共通）。
 *
 * 案件ごとに手順書を作ると、見本・素材・手順の三つがずれる（実際にずれて、就労者もプロも
 * 完成させられなかった）。そこで手順は案件ごとに作らず、この1本のデータだけを使う。
 * 各ステップの「やり方」は教科書（chapters.ts）の章と節に紐づけ、説明と操作動画は
 * 教科書側だけが持つ。案件ごとに変わるのは素材と文字だけで、手順そのものは変わらない。
 */
import { GUIDE_CHAPTERS, type GuideChapter } from "./chapters";

export interface WorkStep {
  id: string;
  /** 就労者がやること（1行。詳しいやり方は教科書の動画と写真を見る） */
  title: string;
  /** どこから何を持ってくるか。案件ごとに変わるのは「文字」だけなので、その在り処を書く */
  detail: string;
  /** 教科書の参照 "章slug#節id"（chapters.ts）。null は教科書に対応する章がない作業 */
  guide: string | null;
}

export const WORK_STEPS: WorkStep[] = [
  {
    id: "project",
    title: "プロジェクトを作る",
    detail: "DaVinci を開いて、この動画用のプロジェクトを1つ作ります。",
    guide: "project#new",
  },
  {
    id: "import",
    title: "素材を入れる",
    detail: "配られた「素材」フォルダを、フォルダごとメディアプールにドラッグします。",
    guide: "import#drag",
  },
  {
    id: "arrange",
    title: "素材を並べる",
    detail:
      "［ワークスペース］→［スクリプト］→［絆_素材を並べる］を押すと、映像・セリフ・BGM が完成見本と同じ間隔で並びます。",
    guide: "arrange#auto",
  },
  {
    id: "subtitles",
    title: "字幕を入れる",
    detail:
      "セリフ1本につき字幕を1つ。話す人の型を置き、長さを音声に合わせ、文字は「依頼内容」タブの作業指示一覧からコピーします。",
    guide: "subtitles#place",
  },
  {
    id: "telop",
    title: "強調テロップを入れる",
    detail:
      "作業指示一覧の「強調テロップ」に文字が書いてある場面だけ入れます。空いている場面には入れません。",
    guide: "telop#place",
  },
  {
    id: "audio",
    title: "BGM の音量を下げる",
    detail: "BGM を全部えらんで、音量に -20 と入れます。声の大きさはさわりません。",
    guide: "audio#volume",
  },
  {
    id: "export",
    title: "書き出す",
    detail:
      "プリセット「絆_YouTube_720p」をえらんで、MP4 ファイルにします。ファイル名は依頼内容のとおりに。",
    guide: "export#preset",
  },
  {
    id: "submit",
    title: "見直して提出する",
    detail:
      "書き出した動画を最初から最後まで見て、完成見本と見くらべてから「提出」タブで送ります。",
    guide: null,
  },
];

export interface WorkStepView extends WorkStep {
  /** 教科書の章（動画・タイトル）。guide が無い／章が見つからないときは null */
  chapter: GuideChapter | null;
  /** 教科書ページの URL（basePath は利用者 "/guide"、職員 "/staff/guide"） */
  href: string | null;
  video: { src: string; poster?: string } | null;
}

/** 作業の流れに、教科書の章（動画とリンク）を結びつけて返す */
export function getWorkSteps(basePath = "/guide"): WorkStepView[] {
  return WORK_STEPS.map((step) => {
    const [slug, section] = (step.guide ?? "").split("#");
    const chapter = GUIDE_CHAPTERS.find((c) => c.slug === slug) ?? null;
    const hasSection = Boolean(
      section && chapter?.sections.some((s) => s.id === section),
    );
    return {
      ...step,
      chapter,
      href: chapter
        ? `${basePath}/${chapter.slug}${hasSection ? `#${section}` : ""}`
        : null,
      video: chapter?.video ?? null,
    };
  });
}
