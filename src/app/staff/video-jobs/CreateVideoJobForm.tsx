"use client";

import { useActionState } from "react";
import { createVideoJob } from "@/lib/actions/videoJobs";
import { TEMPLATE_REGISTRY, type VideoTemplateType } from "@/lib/video/templates";
import { SKILL_TAG_LABELS } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

// 就労者が編集する練習素材は実写寄りの1本立て（キャラクター解説テンプレは廃止）。
// ジャンル選択はやめ、テーマを入れれば実写Bロール＋ナレーション構成で自動生成する。
const TEMPLATE: VideoTemplateType = "business_explainer";

export interface VideoCaseOption {
  id: string;
  title: string;
  genre: string | null;
}

const QUICK_CASE_CONTEXT = `クラウドワークス等でよくある動画編集案件を想定する。
- 依頼内容: SNSまたはYouTube向けの短尺PR/解説動画を編集する
- 必要な構成: 冒頭の引き、要点整理、Bロール、テロップ、BGM、締めのCTA
- 納品形式: MP4、指定尺、スマホでも読みやすいテロップ
- 修正されやすい点: テロップの誤字、尺のズレ、BGM音量、テンポ不足、訴求の弱さ
- 練習目的: 実案件の依頼文から動画構成を読み取り、完成見本に近づける`;

export function CreateVideoJobForm({ caseOptions = [] }: { caseOptions?: VideoCaseOption[] }) {
  const [state, formAction, isPending] = useActionState(createVideoJob, initialState);
  const config = TEMPLATE_REGISTRY[TEMPLATE];
  const latestCase = caseOptions[0];

  return (
    <div className="space-y-5">
      <form action={formAction} className="rounded-2xl border-2 border-primary/30 bg-primary-soft p-5">
        <input type="hidden" name="template_type" value={TEMPLATE} />
        <input
          type="hidden"
          name="theme"
          value={latestCase ? latestCase.title : "クラウドワークス実案件を想定した動画編集練習"}
        />
        <input type="hidden" name="difficulty" value={config.defaultDifficulty} />
        <input type="hidden" name="target_duration_sec" value={config.durationRange.default} />
        <input type="hidden" name="use_broll" value="on" />
        {latestCase ? (
          <input type="hidden" name="source_case_id" value={latestCase.id} />
        ) : (
          <input type="hidden" name="case_context" value={QUICK_CASE_CONTEXT} />
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-ink">AI動画を1クリック生成</p>
            <p className="mt-1 text-sm text-ink-soft">
              {latestCase
                ? `最新の保存済み実案件「${latestCase.title}」をもとに、台本・音声・完成見本・教材を作ります。`
                : "保存済み実案件がないため、クラウドワークス実案件で多い要件をもとに作ります。"}
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-14 rounded-2xl bg-primary px-6 text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
          >
            {isPending ? "生成を登録中..." : "AI動画を生成"}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          生成は職員のパソコンが裏側で処理するため、案件一覧に反映されるまで数分ほど時間がかかります。
          実写映像背景は Pexels のAPIキー設定が済むまでは静止画背景になります。
        </p>
      </form>

    <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      {/* ジャンルは固定（実写Bロール＋ナレーション）。フォームには出さず内部で指定する。 */}
      <input type="hidden" name="template_type" value={TEMPLATE} />

      <div>
        <label htmlFor="theme" className="block font-bold text-ink">
          案件のテーマ <span className="text-danger">*</span>
        </label>
        <input
          id="theme"
          name="theme"
          type="text"
          required
          placeholder="例: 在庫管理のコツ / スマートフォンの選び方"
          className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-sm text-ink-soft">
          テーマを入れるだけで、実写映像＋ナレーション＋テロップの練習用動画と、依頼書・仕様書・正解データを自動で用意します。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="difficulty" className="block font-bold text-ink">
            難易度
          </label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={config.defaultDifficulty}
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          >
            <option value={1}>レベル1（順番どおり・詳細な手順書）</option>
            <option value={2}>レベル2（順番判断・BGM/字幕調整）</option>
            <option value={3}>レベル3（依頼書と素材のみ）</option>
          </select>
        </div>
        <div>
          <label htmlFor="target_duration_sec" className="block font-bold text-ink">
            目標動画時間（秒）
          </label>
          <input
            id="target_duration_sec"
            name="target_duration_sec"
            type="number"
            min={config.durationRange.min}
            max={config.durationRange.max}
            defaultValue={config.durationRange.default}
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          />
          <p className="mt-1 text-xs text-ink-soft">
            {config.durationRange.min}〜{config.durationRange.max}秒（既定{config.durationRange.default}秒）／
            {config.width}x{config.height}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-page p-3 text-sm text-ink-soft">
        練習できる技術: {config.skillTags.map((t) => SKILL_TAG_LABELS[t] ?? t).join("・")}
      </div>

      <p className="rounded-xl bg-page p-3 text-sm text-ink-soft">
        生成を開始すると、台本→音声→実写素材の用意→完成見本→素材パッケージ→案件登録の順に処理されます。
        実処理は生成用マシン（ワーカー）が拾って実行するため、反映まで少し時間がかかります。
      </p>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 font-bold text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-xl bg-success-soft p-4 font-bold text-success">
          登録しました。下の一覧に「待機中」として表示されます。
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "登録しています…" : "案件を作成する"}
      </button>
    </form>
    </div>
  );
}
