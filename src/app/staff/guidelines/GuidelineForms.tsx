"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addManualGuideline,
  setManualGuidelineActive,
  updateManualGuideline,
} from "@/lib/actions/manualSteps";
import type { ActionState } from "@/lib/actions/assignments";
import type { ManualGuideline } from "@/lib/types";
import { SKILL_TAG_LABELS } from "@/lib/types";

const initial: ActionState = { error: null };

const ALL_SKILL_TAGS = Object.keys(SKILL_TAG_LABELS);

/** 新しい学習ルールを直接追加するフォーム（案件を経由せずに登録したいとき用）。 */
export function NewGuidelineForm() {
  const [state, action, pending] = useActionState(addManualGuideline, initial);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">見出し（短い要約）</span>
        <input
          name="title"
          required
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          placeholder="例: 完成見本を見る手順を書かない"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">
          ルール（AIに守らせること）
        </span>
        <textarea
          name="rule"
          required
          rows={2}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">
          理由（なぜ直すのか）※必須
        </span>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">NG例（任意）</span>
          <textarea
            name="example_before"
            rows={2}
            className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">OK例（任意）</span>
          <textarea
            name="example_after"
            rows={2}
            className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-xs font-bold text-ink-soft">
          対象スキル（選ばなければ全案件に適用）
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ALL_SKILL_TAGS.map((tag) => (
            <label
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs"
            >
              <input type="checkbox" name="skill_tags" value={tag} />
              {SKILL_TAG_LABELS[tag] ?? tag}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "登録中…" : "ルールを追加する"}
        </button>
        {state.success && (
          <span className="font-bold text-success">登録しました ✅</span>
        )}
        {state.error && (
          <span role="alert" className="font-bold text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * 既存の学習ルールを編集するフォーム（rule/reasonが曖昧・NG/OK例が空だと
 * プロンプトへの拘束力が弱いため、seedルールと同水準まで具体化できるようにする）。
 * 折りたたみ式：親カードの「編集」ボタンで開閉する。
 */
export function EditGuidelineForm({
  guideline,
  onDone,
}: {
  guideline: ManualGuideline;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateManualGuideline,
    initial,
  );

  if (state.success) onDone();

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
      <input type="hidden" name="guideline_id" value={guideline.id} />
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">見出し（短い要約）</span>
        <input
          name="title"
          required
          defaultValue={guideline.title}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">
          ルール（AIに守らせること。何を書くな／何を書けまで具体的に）
        </span>
        <textarea
          name="rule"
          required
          rows={2}
          defaultValue={guideline.rule}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-soft">
          理由（なぜ直すのか）※必須
        </span>
        <textarea
          name="reason"
          required
          rows={2}
          defaultValue={guideline.reason}
          className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">
            NG例（できるだけ埋める。AIは指示文より実例を真似しやすい）
          </span>
          <textarea
            name="example_before"
            rows={2}
            defaultValue={guideline.example_before ?? ""}
            className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-soft">OK例</span>
          <textarea
            name="example_after"
            rows={2}
            defaultValue={guideline.example_after ?? ""}
            className="mt-1 block w-full rounded-lg border-2 border-line px-3 py-2 text-sm"
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-xs font-bold text-ink-soft">
          対象スキル（選ばなければ全案件に適用）
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ALL_SKILL_TAGS.map((tag) => (
            <label
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs"
            >
              <input
                type="checkbox"
                name="skill_tags"
                value={tag}
                defaultChecked={guideline.skill_tags.includes(tag)}
              />
              {SKILL_TAG_LABELS[tag] ?? tag}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存する"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-xl border-2 border-line px-4 py-2 text-sm font-bold text-ink-soft hover:bg-page"
        >
          キャンセル
        </button>
        {state.error && (
          <span role="alert" className="font-bold text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

/** 学習ルールの有効/無効を切り替えるボタン。無効化すると以後の生成に注入されない。 */
export function ToggleActiveButton({
  guidelineId,
  isActive,
}: {
  guidelineId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setManualGuidelineActive(guidelineId, !isActive);
        })
      }
      className={`min-h-9 rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${
        isActive
          ? "bg-success-soft text-success hover:bg-success/20"
          : "bg-page text-ink-soft hover:bg-line/40"
      }`}
    >
      {pending ? "…" : isActive ? "有効（クリックで無効化）" : "無効（クリックで有効化）"}
    </button>
  );
}

/** ルール1件のカード表示。「編集」で EditGuidelineForm を開閉する。 */
export function GuidelineCard({ guideline }: { guideline: ManualGuideline }) {
  const [editing, setEditing] = useState(false);
  const g = guideline;

  return (
    <li
      className={`rounded-xl border p-4 ${
        g.is_active ? "border-line bg-surface" : "border-line bg-page opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-ink">{g.title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="min-h-9 rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-page"
          >
            {editing ? "編集を閉じる" : "編集"}
          </button>
          <ToggleActiveButton guidelineId={g.id} isActive={g.is_active} />
        </div>
      </div>

      {editing ? (
        <EditGuidelineForm guideline={g} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            <span className="font-bold text-ink-soft">ルール: </span>
            {g.rule}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            <span className="font-bold text-ink-soft">理由: </span>
            {g.reason}
          </p>
          {(g.example_before || g.example_after) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {g.example_before && (
                <p className="rounded-lg bg-danger/5 p-2 text-xs text-ink">
                  <span className="font-bold text-danger">NG: </span>
                  {g.example_before}
                </p>
              )}
              {g.example_after && (
                <p className="rounded-lg bg-success-soft p-2 text-xs text-ink">
                  <span className="font-bold text-success">OK: </span>
                  {g.example_after}
                </p>
              )}
            </div>
          )}
          {!g.example_before && !g.example_after && (
            <p className="mt-2 rounded-lg bg-warning-soft p-2 text-xs text-ink-soft">
              NG例・OK例が未設定です。実例が無いとAIへの拘束力が弱くなります。「編集」から追加してください。
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {g.skill_tags.length === 0 ? (
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark">
                全案件に適用
              </span>
            ) : (
              g.skill_tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark"
                >
                  {SKILL_TAG_LABELS[t] ?? t}
                </span>
              ))
            )}
            {g.source_task_id && (
              <a
                href={`/staff/tasks/${g.source_task_id}`}
                className="text-xs font-bold text-primary hover:underline"
              >
                修正元の案件を見る →
              </a>
            )}
          </div>
        </>
      )}
    </li>
  );
}
