"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createVideoJob } from "@/lib/actions/videoJobs";
import {
  TEMPLATE_REGISTRY,
  VIDEO_TEMPLATE_TYPES,
  isTemplateImplemented,
  type VideoTemplateType,
} from "@/lib/video/templates";
import { SKILL_TAG_LABELS } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assignments";

const initialState: ActionState = { error: null };

export function CreateVideoJobForm() {
  const [state, formAction, isPending] = useActionState(createVideoJob, initialState);
  const [templateType, setTemplateType] = useState<VideoTemplateType>("character_explainer");
  const [useBroll, setUseBroll] = useState(false);
  const config = TEMPLATE_REGISTRY[templateType];
  const implemented = isTemplateImplemented(templateType);
  const templateSelectRef = useRef<HTMLSelectElement>(null);
  const difficultySelectRef = useRef<HTMLSelectElement>(null);

  // React 19のフォームアクションは成功後にネイティブ<form>.reset()を呼ぶため、
  // <select>が（controlled valueとは無関係に）DOM上の最初のoptionへ戻ってしまう。
  // 送信が確定するたびに、React側の状態に合わせて明示的に書き戻す。
  useEffect(() => {
    if (templateSelectRef.current) templateSelectRef.current.value = templateType;
    if (difficultySelectRef.current) difficultySelectRef.current.value = String(config.defaultDifficulty);
  }, [state, templateType, config.defaultDifficulty]);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <label htmlFor="template_type" className="block font-bold text-ink">
          案件ジャンル <span className="text-danger">*</span>
        </label>
        <select
          id="template_type"
          name="template_type"
          ref={templateSelectRef}
          value={templateType}
          onChange={(e) => setTemplateType(e.target.value as VideoTemplateType)}
          className="mt-1 w-full rounded-xl border-2 border-line p-3"
        >
          {VIDEO_TEMPLATE_TYPES.map((type) => (
            <option key={type} value={type}>
              {TEMPLATE_REGISTRY[type].label}
              {isTemplateImplemented(type) ? "" : "（準備中）"}
            </option>
          ))}
        </select>

        <div className="mt-3 rounded-xl bg-page p-4 text-sm text-ink-soft">
          <p className="text-ink">{config.description}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <dt>画面サイズ</dt>
            <dd className="text-ink">
              {config.width}x{config.height}（{config.aspectRatio}）
            </dd>
            <dt>目標尺</dt>
            <dd className="text-ink">
              {config.durationRange.min}〜{config.durationRange.max}秒（既定{config.durationRange.default}秒）
            </dd>
            <dt>練習できる技術</dt>
            <dd className="text-ink">{config.skillTags.map((t) => SKILL_TAG_LABELS[t] ?? t).join("・")}</dd>
          </dl>
          {!implemented && (
            <p className="mt-2 font-bold text-danger">このジャンルは準備中のため、まだ生成できません。</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="theme" className="block font-bold text-ink">
          動画のテーマ <span className="text-danger">*</span>
        </label>
        <input
          id="theme"
          name="theme"
          type="text"
          required
          placeholder="例: スマートフォンの歴史"
          className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="difficulty" className="block font-bold text-ink">
            難易度
          </label>
          <select
            id="difficulty"
            name="difficulty"
            ref={difficultySelectRef}
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
            key={templateType}
            className="mt-1 w-full rounded-xl border-2 border-line p-3"
          />
        </div>
      </div>

      <div className="rounded-xl border-2 border-line p-4">
        <label className="flex items-center gap-2 font-bold text-ink">
          <input
            type="checkbox"
            name="use_broll"
            checked={useBroll}
            onChange={(e) => setUseBroll(e.target.checked)}
            className="h-5 w-5"
          />
          実写Bロール背景を使う（Pexels）
        </label>
        <p className="mt-1 text-sm text-ink-soft">
          スライドの代わりに実写映像を背景に使い、より本番に近い見た目にします。
          ワーカーに <code>PEXELS_API_KEY</code> の設定が必要です（未設定なら自動で静止画になります）。
        </p>
        {useBroll && (
          <div className="mt-3">
            <label htmlFor="broll_keywords" className="block text-sm font-bold text-ink">
              検索キーワード（英語推奨・カンマ区切り）
            </label>
            <input
              id="broll_keywords"
              name="broll_keywords"
              type="text"
              placeholder="例: warehouse inventory, logistics workers, office team meeting"
              className="mt-1 w-full rounded-xl border-2 border-line p-3 focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-sm text-ink-soft">
              空欄ならテーマから自動で探します（英語のほうが実写素材が見つかりやすいです）。
            </p>
          </div>
        )}
      </div>

      <p className="rounded-xl bg-page p-3 text-sm text-ink-soft">
        生成を開始すると、台本→音声→字幕→完成見本のレンダリング→素材パッケージ化→案件登録の順に処理されます。
        実処理は職員のワーカー（ffmpegが使えるマシン）が拾って実行するため、反映まで少し時間がかかります。
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
        disabled={isPending || !implemented}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "登録しています…" : "AI模擬案件を作成する"}
      </button>
    </form>
  );
}
