/** トーク内の日付区切り（「今日」「9月18日(木)」など） */
export function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex justify-center" role="separator" aria-label={label}>
      <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-bold text-ink-soft">
        {label}
      </span>
    </div>
  );
}
