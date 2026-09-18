"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { IconBook, IconCheckCircle, IconHelp, IconPlayCircle } from "@/components/ui/icons";
import type { WorkStepView } from "@/lib/guide/workflow";

interface WorkStepsProps {
  steps: WorkStepView[];
  /** チェックの保存先を案件ごとに分けるためのキー */
  assignmentId: string;
  /** 教科書のトップ（利用者 "/guide"、職員 "/staff/guide"） */
  guideTopHref?: string;
  /** 設定で読み上げをオンにしている人に、各ステップの読み上げボタンを出す */
  readAloudEnabled?: boolean;
}

// チェックの状態は localStorage（この人のこのパソコンだけ）に置く。
// 外部ストアとして購読し、同じ案件を別タブで開いていても表示がそろうようにする。
const storageKey = (assignmentId: string) => `kizuna:worksteps:${assignmentId}`;
const EMPTY = "[]";

const listeners = new Set<() => void>();
let snapshotKey: string | null = null;
let snapshotValue = EMPTY;

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? EMPTY;
  } catch {
    return EMPTY; // プライベートウィンドウなどで読めなくても、手順は普通に使える
  }
}

/** getSnapshot は同じ値なら同じ参照を返す必要があるので、読んだ結果をキャッシュする */
function getSnapshot(key: string): string {
  if (snapshotKey !== key) {
    snapshotKey = key;
    snapshotValue = readRaw(key);
  }
  return snapshotValue;
}

function writeSnapshot(key: string, value: string) {
  snapshotKey = key;
  snapshotValue = value;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 保存できなくても、画面上のチェックは効く
  }
  listeners.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) {
      snapshotKey = null; // 別タブで変わったら読み直す
      listener();
    }
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function parseDone(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * 作業の進め方（全案件共通）。
 * 上から1つずつ。各ステップで「動画を見る」か「教科書をひらく」ができ、できたらチェックする。
 */
export function WorkSteps({
  steps,
  assignmentId,
  guideTopHref = "/guide",
  readAloudEnabled = false,
}: WorkStepsProps) {
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const key = storageKey(assignmentId);

  const raw = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    useCallback(() => getSnapshot(key), [key]),
    () => EMPTY, // サーバー描画では空（チェックはこの人のパソコンの中だけ）
  );
  const done = useMemo(() => parseDone(raw), [raw]);

  const toggle = (id: string) => {
    const next = done.includes(id)
      ? done.filter((v) => v !== id)
      : [...done, id];
    writeSnapshot(key, JSON.stringify(next));
  };

  const doneCount = steps.filter((s) => done.includes(s.id)).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const currentId = steps.find((s) => !done.includes(s.id))?.id ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">作業の進め方</h2>
          <span className="text-[15px] font-bold text-ink">
            {doneCount} / {steps.length} 完了
          </span>
        </div>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
          上から順にやれば完成します。やり方が分からないときは、そのステップの
          <span className="font-bold text-ink">［動画を見る］</span>
          を押してください。
        </p>
        <div className="mt-3">
          <ProgressBar percent={percent} />
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const isDone = done.includes(step.id);
          const isCurrent = step.id === currentId;
          const videoOpen = openVideo === step.id;
          return (
            <li
              key={step.id}
              className={`rounded-2xl border bg-surface p-4 shadow-card transition ${
                isCurrent
                  ? "border-primary/60 ring-2 ring-primary/20"
                  : "border-line"
              } ${isDone ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-8 flex-none items-center justify-center rounded-full text-[15px] font-bold ${
                    isDone
                      ? "bg-success-soft text-success"
                      : isCurrent
                        ? "bg-primary text-white"
                        : "bg-page text-ink-soft"
                  }`}
                >
                  {isDone ? <IconCheckCircle className="size-5" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold leading-snug text-ink">
                      {step.title}
                    </h3>
                    {isCurrent && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                        いま ここ
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
                    {step.detail}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {readAloudEnabled && (
                      <ReadAloudButton text={`${step.title}。${step.detail}`} />
                    )}
                    {step.video && (
                      <button
                        type="button"
                        onClick={() => setOpenVideo(videoOpen ? null : step.id)}
                        aria-expanded={videoOpen}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-primary/30 bg-primary-soft/40 px-4 text-[15px] font-bold text-primary transition hover:bg-primary-soft"
                      >
                        <IconPlayCircle className="size-5" />
                        {videoOpen ? "動画をとじる" : "動画を見る"}
                      </button>
                    )}
                    {step.href && (
                      <Link
                        href={step.href}
                        target="_blank"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-bold text-ink transition hover:bg-page"
                      >
                        <IconBook className="size-5" />
                        教科書をひらく
                      </Link>
                    )}
                  </div>

                  {videoOpen && step.video && (
                    <div className="mt-3">
                      <video
                        controls
                        autoPlay
                        preload="metadata"
                        poster={step.video.poster}
                        className="aspect-video w-full rounded-xl border border-line bg-black"
                      >
                        <source src={step.video.src} type="video/mp4" />
                      </video>
                      <p className="mt-1.5 text-sm text-ink-soft">
                        声で説明しながら、実際に操作している動画です。
                      </p>
                    </div>
                  )}

                  <label className="mt-3 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl px-2 text-[15px] font-bold text-ink hover:bg-page">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggle(step.id)}
                      className="size-6 rounded accent-success"
                    />
                    できた
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-base font-bold text-ink">こまったとき</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
          まちがえて置いてしまった、型が出てこない、といったときの直し方は教科書にまとめてあります。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`${guideTopHref}/trouble`}
            target="_blank"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-primary/30 bg-primary-soft/40 px-4 text-[15px] font-bold text-primary transition hover:bg-primary-soft"
          >
            <IconHelp className="size-5" />
            こまったときを見る
          </Link>
          <Link
            href={guideTopHref}
            target="_blank"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[15px] font-bold text-ink transition hover:bg-page"
          >
            <IconBook className="size-5" />
            教科書の目次
          </Link>
        </div>
      </div>
    </div>
  );
}
