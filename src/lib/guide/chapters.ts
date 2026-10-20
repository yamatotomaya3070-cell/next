/**
 * 職員の方の準備（パソコンの準備・ワーカーPC）。利用者の教科書（lessons/）とは分けて、職員の画面にだけ出す。
 * 案件の手順や操作辞典からの参照（guideHref / guideLabel）は、レッスンの slug と、ここの "章slug#節id" の両方を受ける。
 * 2026-10-20 より前の章の参照（"subtitles#place" など）は lessons/legacy.ts でレッスンへ読みかえる。
 */
import { getLesson } from "./lessons";
import { legacyLessonSlug } from "./lessons/legacy";
import type { GuideMark } from "./lessons/types";

export type { GuideExample, GuideMark } from "./lessons/types";

export interface GuideStep {
  text: string;
  /** キー操作などの補足 */
  hint?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  lead?: string;
  steps: GuideStep[];
  image?: { src: string; alt: string; marks?: GuideMark[] };
  note?: { kind: "tip" | "warn"; title: string; body: string };
  /** この節で使うファイル（public に置いたもの） */
  download?: { href: string; label: string; size: string };
}

export interface GuideChapter {
  slug: string;
  no: number;
  title: string;
  summary: string;
  sections: GuideSection[];
}

export const STAFF_CHAPTERS: GuideChapter[] = [
  {
    slug: "setup",
    no: 1,
    title: "パソコンの準備（職員の方へ）",
    summary: "利用者の方が使うパソコン1台ごとに、最初に1回だけ行います。",
    sections: [
      {
        id: "install",
        title: "DaVinci Resolve を入れる",
        steps: [
          { text: "Blackmagic Design のサイトから DaVinci Resolve 21（無料版。「Studio」ではない方）をダウンロードしてインストールし、1回起動する" },
          { text: "画面が英語なら、［DaVinci Resolve］→［Preferences］→［User］→［UI Settings］→［Language］を日本語にして再起動する" },
          { text: "Mac も同じです。インストールのとちゅうで「アクセスを許可しますか」と出たら［許可］を押します" },
        ],
        note: {
          kind: "warn",
          title: "バージョンを 21 にそろえる",
          body: "教科書の画面の写真とボタンの名前は、DaVinci Resolve 21 で撮っています。ほかのバージョンでは名前や場所がちがうことがあるので、全部のパソコンを 21 にそろえてください。",
        },
      },
    ],
  },
  {
    slug: "worker",
    no: 2,
    title: "案件を作る・提出動画を検品するパソコンの準備（職員の方へ）",
    summary:
      "「YouTube動画生成」で案件を作ることと、利用者が提出した動画を完成見本と自動で照合することは、事業所のパソコン1台で動く「ワーカー」が行います。その1台を準備します。",
    sections: [
      {
        id: "why",
        title: "なぜ必要か",
        lead: "アプリ（URL）は、テーマを「待機中」のジョブとして受け付けるところと、提出された動画を「順番待ち」として受け取るところまでしかしません。",
        steps: [
          { text: "動画の組み立て（音声を作る・場面の映像を描く・素材ZIPを作る・関門を通す・案件を登録する）は、パソコンの中で動く「YouTube動画生成ワーカー」が行います" },
          { text: "提出動画の検品（長さ・セリフの入れ忘れや重複・字幕の入れ忘れや文言違いを完成見本と照合し、明らかな間違いは利用者へ自動で差し戻す）は、同じパソコンで動く「提出動画の検品ワーカー」が行います" },
          { text: "ワーカーが動いているパソコンが1台も無いと、動画生成は「待機中」のまま、提出動画の照合は「順番待ち」のまま進みません" },
          { text: "ワーカーはインターネット経由でアプリとつながるので、どのパソコンでも構いません。ただし事業所で1台だけにします。セットアップは1回で、2つのワーカーが一緒に入ります" },
        ],
        note: {
          kind: "warn",
          title: "向いているパソコン",
          body: "常に電源が入っているデスクトップパソコン（Windows 10 / 11）。持ち運ぶノートパソコンは、閉じている間に案件が作られないので不向きです。2台で動かすと同じジョブを取り合うので、1台だけにしてください。",
        },
      },
      {
        id: "setup",
        title: "セットアップする（1台に1回だけ）",
        lead: "必要なソフト（Git・Node.js・ffmpeg）を自動で入れ、アプリのコードを取ってきて、パソコン起動時にワーカーが自動で立ち上がるようにします。",
        download: { href: "/guide/setup/kizuna_worker_setup.zip", label: "ワーカー セットアップ用ファイルをダウンロード", size: "6KB" },
        steps: [
          { text: "下の［ワーカー セットアップ用ファイルをダウンロード］を押し、ダウンロードした ZIP を右クリック →［すべて展開］する" },
          { text: "開発担当から受け取った「設定ファイル.txt」を、展開したフォルダ（bat と同じ場所）に入れる" },
          { text: "「セットアップ（職員用）.bat」をダブルクリックする" },
          { text: "「このアプリがデバイスに変更を加えることを許可しますか」と出たら［はい］。ソフトを入れるので数分かかります" },
          { text: "「セットアップが終わりました」と出たら完了。2つのワーカーが自動で起動し、タスクバーに「絆ワーカー」の窓が2つ出ます" },
        ],
        note: {
          kind: "tip",
          title: "設定ファイルが無いとき",
          body: "bat を実行すると、Supabase の URL・service role key・Gemini の API キーの3つを聞かれます。開発担当から受け取った値を貼り付けて Enter を押してください。",
        },
      },
      {
        id: "check",
        title: "動いているか確かめる",
        steps: [
          { text: "タスクバーに「絆ワーカー（YouTube動画生成）」「絆ワーカー（提出動画の検品）」という黒い窓が2つ最小化で出ています。どちらも閉じないでください（閉じるとそのワーカーが止まります）" },
          { text: "職員メニューの「YouTube動画生成」でテーマを登録すると、一覧の「待機中」が数分で進み、5〜6分で「完了」になって案件一覧に現れます" },
          { text: "利用者が動画を提出すると、「提出物レビュー」の「自動チェック（機械検品）」に数分で結果が出ます（5分の動画で5分前後）。明らかな間違いがあれば、利用者へは自動で差し戻されています" },
          { text: "パソコンを再起動しても、ワーカーは自動で立ち上がります（スタートアップに登録済み）" },
        ],
      },
      {
        id: "update",
        title: "更新する",
        steps: [
          { text: "開発担当から「更新してください」と連絡があったら、展開したフォルダの「更新（職員用）.bat」をダブルクリックする" },
          { text: "動いているワーカーを止め、コードを最新にして、もう一度起動します。設定はそのままです" },
        ],
      },
      {
        id: "trouble",
        title: "こまったとき",
        steps: [
          { text: "「待機中」や「順番待ち」のまま進まない → ワーカーが動いていません。デスクトップの「絆ワーカーを起動」をダブルクリックするか、パソコンを再起動する" },
          { text: "「失敗」になる → 「絆ワーカー」の窓に赤い文が出ています。その文を開発担当に伝える" },
          { text: "準備がそろっているかを調べたいとき → 「更新（職員用）.bat」を実行すると、最後に ○× の一覧が出ます" },
        ],
      },
    ],
  },
];

export function getStaffChapter(slug: string): GuideChapter | undefined {
  return STAFF_CHAPTERS.find((c) => c.slug === slug);
}

/**
 * 手順や辞典の参照を、教科書ページの URL にする。
 * レッスンの slug（"cut-basics"）、職員の章（"worker#update"）、古い章の参照（"subtitles#place"）を受ける。
 */
export function guideHref(basePath: string, ref: string): string | null {
  const lesson = getLesson(ref) ?? getLesson(legacyLessonSlug(ref) ?? "");
  if (lesson) return `${basePath}/${lesson.slug}`;
  const [slug, section] = ref.split("#");
  const chapter = getStaffChapter(slug);
  if (!chapter) return null;
  const hasSection = section && chapter.sections.some((s) => s.id === section);
  return `${basePath}/${chapter.slug}${hasSection ? `#${section}` : ""}`;
}

/** リンクに出す名前 */
export function guideLabel(ref: string): string | null {
  const lesson = getLesson(ref) ?? getLesson(legacyLessonSlug(ref) ?? "");
  if (lesson) return `${lesson.no} ${lesson.title}`;
  const [slug, section] = ref.split("#");
  const chapter = getStaffChapter(slug);
  if (!chapter) return null;
  const sec = chapter.sections.find((s) => s.id === section);
  return sec ? `${chapter.title}／${sec.title}` : chapter.title;
}
