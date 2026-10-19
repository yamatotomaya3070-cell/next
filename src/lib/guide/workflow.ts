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
      "［ワークスペース］→［スクリプト］→［絆_素材を並べる］を押すと、映像・セリフ・BGM が順番どおりに並びます。セリフはすき間なくつながります（セリフの間（ま）は音声ファイルの中に無音として入っているので、自分で間を空けません）。メニューに無いときは職員の方に声をかけてください。",
    guide: "arrange#auto",
  },
  {
    id: "subtitles",
    title: "字幕を入れる",
    detail:
      "セリフ1本につき字幕を1つ。話す人の型を置き、長さを音声に合わせ、文字はこの画面の下の「作業指示一覧」からコピーします。",
    guide: "subtitles#place",
  },
  {
    id: "telop",
    title: "強調テロップを入れる",
    detail:
      "作業指示一覧の「強調テロップ」の欄に文字がある行だけ、そのセリフの頭から場面の終わりまで入れます。出だしは 8フレームのフェードインで、ふわっと出します。",
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
      "書き出した動画を最初から最後まで見て、作業指示一覧とくらべてから「提出」タブで送ります。送っている間は進み具合（％）が出ます。「提出できました」と出たら完了で、もう一度送る必要はありません。結果は「レビュー結果」タブに届きます。",
    guide: "export#submit",
  },
];

export interface WorkStepView extends WorkStep {
  /** 教科書の章（動画・タイトル）。guide が無い／章が見つからないときは null */
  chapter: GuideChapter | null;
  /** 教科書ページの URL（basePath は利用者 "/guide"、職員 "/staff/guide"） */
  href: string | null;
  video: { src: string; poster?: string } | null;
}

// 「YouTube動画生成」以外で作った案件（CrowdWorks の実案件など）は、素材のファイル名が
// ［絆_素材を並べる］の決まりに合わず、字幕やテロップの見た目も絆の型ではなく依頼主の指定に
// 合わせる必要があるので、並べる・字幕・テロップ・書き出しの4つを差し替える。
const MANUAL_ARRANGE: Record<string, Pick<WorkStep, "detail" | "guide">> = {
  arrange: {
    detail:
      "この案件は自動で並べられません。依頼内容と作業指示を見ながら、音声と映像をタイムラインに順番どおり並べます。間（ま）の指定が依頼内容に無ければ、セリフの音声は前のクリップの右はしにすき間なくつなげて並べます。",
    guide: "arrange#manual-voices",
  },
  subtitles: {
    detail:
      "依頼内容で指定された見た目（フォント・大きさ・色・位置）に合わせて、エフェクトの欄の［タイトル］から［テキスト］を置き、インスペクタで見た目を変えます。1つ作ったらコピーして使い回し、文字は依頼書や台本から入れます。",
    guide: "subtitles#custom",
  },
  telop: {
    detail:
      "依頼内容にテロップの指定がある場面だけ、［テキスト］を置いて指定どおりの見た目にします。指定が無ければ入れません。",
    guide: "telop#custom",
  },
  export: {
    detail:
      "依頼内容に書いてある形式（大きさ・フレームレート・ファイル名）で MP4 ファイルにします。",
    guide: "export#preset",
  },
};

/**
 * カット練習の案件（録ったままの声を受け取り、自分で切って仕上げる。scripts/scene/buildRawPackage.ts）の流れ。
 * 実際のお仕事と同じ順番（カット → 映像 → 声 → 字幕・テロップ → BGM・効果音 → 書き出し）で、
 * やり方は教科書の第12〜16章（editingChapters.ts）に結びつける。
 */
export const RAW_WORK_STEPS: WorkStep[] = [
  {
    id: "project",
    title: "プロジェクトを作る",
    detail: "DaVinci を開いて、この動画用のプロジェクトを1つ作ります。",
    guide: "project#new",
  },
  {
    id: "import",
    title: "素材を入れて、台本を開く",
    detail:
      "配られた「素材」フォルダを、フォルダごとメディアプールにドラッグします。「台本.txt」はメモ帳で開いて、横に置いておきます（下の「台本」にも同じ文があります）。",
    guide: "import#drag",
  },
  {
    id: "listen",
    title: "声を全部聞いて、消す所を決める",
    detail:
      "場面ごとの声（S01_収録.wav …）を、上から順番に A1 の段へすき間なく並べ、最後まで1回聞きます。録り始めの声、「えー」などの言いよどみ、言いまちがえた所、長い沈黙で M を押して印を付けます。",
    guide: "cut#what",
  },
  {
    id: "cut",
    title: "カットする",
    detail:
      "印の所を切って消し、うしろを詰めます。文と文の間は 5〜8フレーム、話題が変わる所は 12〜24フレームが目安です。字幕や BGM を入れる前に、カットを全部終わらせます。",
    guide: "cut#how",
  },
  {
    id: "video",
    title: "映像を声に合わせて並べる",
    detail:
      "V1 の段に、オープニング・場面ごとの映像・エンディングの順に並べ、場面の映像の長さを、その場面の声の長さに合わせます。映像が足りないときは「素材/静止画」の最後の画面でのばします。黒い所が残らないようにします。",
    guide: "cut#image",
  },
  {
    id: "voice",
    title: "声の大きさをそろえる",
    detail:
      "ミキサーのメーターを見ながら再生します。小さく録れている場面があるので、ノーマライズや音量で、どの場面もメーターが -6〜-3 くらいになるようにそろえます。",
    guide: "voice#even",
  },
  {
    id: "subtitles",
    title: "字幕を入れる",
    detail:
      "話した言葉を全部、画面の下に出します。文は台本からコピーし、1行18文字くらい・2行まで・句読点なしに整えます。声が始まる所で出し、終わる所で消します。",
    guide: "telop-make#write",
  },
  {
    id: "telop",
    title: "強調テロップを入れる",
    detail:
      "大事な数字や結論だけを、画面の上に大きく出します。30秒に1〜2回、10文字くらいまでが目安です。見た目は1つ作ってコピーし、全部そろえます。",
    guide: "telop-make#emphasis",
  },
  {
    id: "typo",
    title: "テロップの誤字を見直す",
    detail: "台本と見くらべる・音を消して文字だけ読む・数字と名前だけ見る、の3回読みます。",
    guide: "telop-make#typo",
  },
  {
    id: "bgm",
    title: "BGM を入れる",
    detail:
      "2曲から1曲えらび、A2 の段に最初から最後まで並べます（曲が短いのでつなげます）。音量は -20 から始めて、声がはっきり聞こえるまで下げ、最後はフェードアウトさせます。",
    guide: "bgm-se#choose-bgm",
  },
  {
    id: "se",
    title: "効果音を入れる",
    detail:
      "強調テロップが出る所などに、A3 の段へ効果音を置きます。音の頭をテロップが出るフレームに合わせ、鳴らしすぎないようにします。",
    guide: "bgm-se#se",
  },
  {
    id: "export",
    title: "書き出す",
    detail: "プリセット「絆_YouTube_720p」をえらんで、MP4 ファイルにします。ファイル名は依頼書のとおりに。",
    guide: "export#preset",
  },
  {
    id: "submit",
    title: "見直して提出する",
    detail:
      "書き出した動画を最初から最後まで見て、見直し一覧で確かめてから「提出」タブで送ります。「提出できました」と出たら完了です。結果は「レビュー結果」タブに届きます。",
    guide: "final-check#checklist",
  },
];

export interface WorkStepsOptions {
  /** 絆の支給素材（YouTube動画生成で作った案件）なら true。［絆_素材を並べる］が使える */
  autoArrange: boolean;
  /** カット練習の案件（録ったままの声を自分で切る）なら true。autoArrange より優先する */
  cutPractice?: boolean;
}

/** 作業の流れに、教科書の章（動画とリンク）を結びつけて返す */
export function getWorkSteps(
  basePath = "/guide",
  { autoArrange, cutPractice = false }: WorkStepsOptions = { autoArrange: true },
): WorkStepView[] {
  const steps = cutPractice
    ? RAW_WORK_STEPS
    : autoArrange
      ? WORK_STEPS
      : WORK_STEPS.map((s) => ({ ...s, ...(MANUAL_ARRANGE[s.id] ?? {}) }));
  return steps.map((step) => {
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
