/**
 * 案件の「作業のしかた」（全案件共通）。
 *
 * 手順は案件ごとに作らず、このデータだけを使う（案件ごとに作ると、見本・素材・手順の三つがずれる）。
 * 各ステップの「やり方」は、教科書のレッスン（lessons/）に結びつける。レッスンで1つずつ練習したことを、
 * 案件ではこの順番でまとめてやる（レッスン 3-1 と同じ順番）。
 * 素材を自動で並べるスクリプトや、用意した字幕の型・書き出しのプリセットは使わない。
 */
import { getLesson } from "./lessons";

export interface WorkStep {
  id: string;
  /** 就労者がやること（1行） */
  title: string;
  /** どこから何を持ってくるか、目安の数字 */
  detail: string;
  /** 教科書のレッスンの slug。null は教科書に対応するレッスンがない作業 */
  guide: string | null;
}

export interface WorkStepView extends WorkStep {
  /** 教科書のレッスンのページの URL（basePath は利用者 "/guide"、職員 "/staff/guide"） */
  href: string | null;
  /** リンクに出すレッスンの番号と名前（"2-2 「えー」・言い直し・録り始めの声を消す"） */
  lessonLabel: string | null;
}

const BRIEF: WorkStep = {
  id: "brief",
  title: "依頼書を読んで、指定を書き出す",
  detail: "「依頼内容」を全部読み、長さ・字幕の見た目・ファイル名などの指定をメモ帳に書き出します。わからない所は、作業を始める前に質問します。",
  guide: "job-brief",
};

const PROJECT: WorkStep = {
  id: "project",
  title: "プロジェクトを作る",
  detail: "DaVinci を開いて、この動画用のプロジェクトを1つ作り、依頼書の大きさ（1280 x 720）と速さ（24）にします。素材を入れる前に決めます。",
  guide: "dv-project",
};

const SUBMIT: WorkStep = {
  id: "submit",
  title: "見直して提出する",
  detail:
    "書き出した動画を最初から最後まで見て、見直し一覧で確かめてから「提出」タブで送ります。「提出できました」と出たら完了です。結果は「レビュー結果」タブに届きます。",
  guide: "pc-submit",
};

/** カット練習の案件（録ったままの声を受け取り、自分で切って仕上げる。scripts/scene/buildRawPackage.ts） */
export const RAW_WORK_STEPS: WorkStep[] = [
  BRIEF,
  PROJECT,
  {
    id: "import",
    title: "素材を入れて、台本を開く",
    detail:
      "配られた「素材」フォルダを、フォルダごとメディアプールにドラッグします。「台本.txt」はメモ帳で開いて、横に置いておきます（下の「台本」にも同じ文があります）。",
    guide: "dv-import",
  },
  {
    id: "listen",
    title: "声を全部聞いて、消す所に印を付ける",
    detail:
      "場面ごとの声（S01_収録.wav …）を、上から順番に A1 の段へすき間なく並べ、最後まで1回聞きます。録り始めの声、「えー」などの言いよどみ、言いまちがえた所、長い沈黙で M を押して印を付けます。",
    guide: "cut-remove",
  },
  {
    id: "cut",
    title: "カットして、間を整える",
    detail:
      "印の所を切って消し、うしろを詰めます。文と文の間は 5〜8フレーム、話題が変わる所は 12〜24フレームが目安です。字幕や BGM を入れる前に、カットを全部終わらせます。",
    guide: "cut-ma",
  },
  {
    id: "video",
    title: "映像を声に合わせて並べる",
    detail:
      "V1 の段に、オープニング・場面ごとの映像・エンディングの順に並べ、場面の映像の長さを、その場面の声の長さに合わせます。映像が足りないときは「素材/静止画」の最後の画面でのばします。黒い所が残らないようにします。",
    guide: "place-video",
  },
  {
    id: "voice",
    title: "声の大きさをそろえる",
    detail:
      "ミキサーのメーターを見ながら再生します。小さく録れている場面があるので、ノーマライズや音量で、どの場面もメーターが -6〜-3 くらいになるようにそろえます。",
    guide: "voice-level",
  },
  {
    id: "subtitles",
    title: "字幕を入れる",
    detail:
      "1つ目の字幕を依頼書の見た目どおりに作り、コピーして全部のセリフに付けます。文は台本からコピーし、1行18文字くらい・2行まで・句読点なしに整えます。声が始まる所で出し、終わる所で消します。",
    guide: "sub-all",
  },
  {
    id: "telop",
    title: "強調テロップを入れる",
    detail:
      "大事な数字や結論だけを、画面の上に大きく出します。30秒に1〜2回、10文字くらいまでが目安です。見た目は1つ作ってコピーし、全部そろえます。",
    guide: "telop",
  },
  {
    id: "bgm",
    title: "BGM を入れる",
    detail:
      "2曲から1曲えらび、A2 の段に最初から最後まで並べます（曲が短いのでつなげます）。音量は -20 から始めて、声がはっきり聞こえるまで下げ、最後はフェードアウトさせます。",
    guide: "bgm",
  },
  {
    id: "se",
    title: "効果音を入れる",
    detail:
      "強調テロップが出る所などに、A3 の段へ効果音を置きます。音の頭をテロップが出るフレームに合わせ、鳴らしすぎないようにします。",
    guide: "se",
  },
  {
    id: "typo",
    title: "誤字を見直す",
    detail: "台本と見くらべる・音を消して文字だけ読む・数字と名前だけ見る、の3回読みます。",
    guide: "final-check",
  },
  {
    id: "export",
    title: "書き出す",
    detail: "依頼書の「納品のしかた」の大きさ・速さ・ファイル名で MP4 にします。1-5 で保存した自分の型（720p_24fps_提出用）を使えます。",
    guide: "dv-export",
  },
  SUBMIT,
];

/**
 * それ以外の案件（声がはじめから切ってある案件、CrowdWorks の実案件など）。
 * カットの代わりに、セリフの音声と映像を自分で並べるところから始める。
 */
export const ARRANGE_WORK_STEPS: WorkStep[] = [
  BRIEF,
  PROJECT,
  {
    id: "import",
    title: "素材を入れる",
    detail: "配られた「素材」フォルダを、フォルダごとメディアプールにドラッグします。",
    guide: "dv-import",
  },
  {
    id: "arrange",
    title: "声と映像を並べる",
    detail:
      "セリフの音声を A1 にファイル名の順にすき間なく並べ、場面の映像を V1 に置いて、その場面の声の長さに合わせます。間（ま）の指定が依頼内容に無ければ、セリフは前のクリップの右はしにすき間なくつなげます。",
    guide: "place-video",
  },
  {
    id: "subtitles",
    title: "字幕を入れる",
    detail:
      "依頼内容で指定された見た目（フォント・大きさ・色・位置）で1つ目を作り、コピーして使い回します。文字は依頼書や台本から入れます。",
    guide: "sub-all",
  },
  {
    id: "telop",
    title: "強調テロップを入れる",
    detail: "依頼内容にテロップの指定がある場面だけ、［テキスト］を置いて指定どおりの見た目にします。指定が無ければ入れません。",
    guide: "telop",
  },
  {
    id: "audio",
    title: "BGM を入れて音量を下げる",
    detail: "BGM を最初から最後まで並べ、声がはっきり聞こえる大きさ（-20 から）にして、最後をフェードアウトさせます。",
    guide: "bgm",
  },
  {
    id: "export",
    title: "書き出す",
    detail: "依頼内容に書いてある形式（大きさ・フレームレート・ファイル名）で MP4 ファイルにします。",
    guide: "dv-export",
  },
  SUBMIT,
];

export interface WorkStepsOptions {
  /** カット練習の案件（録ったままの声を自分で切る）なら true */
  cutPractice?: boolean;
}

/** 作業の流れに、教科書のレッスン（リンクと名前）を結びつけて返す */
export function getWorkSteps(basePath = "/guide", { cutPractice = false }: WorkStepsOptions = {}): WorkStepView[] {
  const steps = cutPractice ? RAW_WORK_STEPS : ARRANGE_WORK_STEPS;
  return steps.map((step) => {
    const lesson = step.guide ? getLesson(step.guide) : undefined;
    return {
      ...step,
      href: lesson ? `${basePath}/${lesson.slug}` : null,
      lessonLabel: lesson ? `${lesson.no} ${lesson.title}` : null,
    };
  });
}
