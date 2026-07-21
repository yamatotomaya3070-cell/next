interface ProgressBarProps {
  percent: number;
  label?: string;
  size?: "sm" | "lg";
  tone?: "primary" | "teal";
}

/** 進捗を視覚的に示すプログレスバー（数値ラベル併記で色だけに頼らない） */
export function ProgressBar({
  percent,
  label,
  size = "lg",
  tone = "primary",
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-sm text-ink-soft">
          <span>{label}</span>
          <span className="font-bold text-ink">{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "進捗"}
        className={`w-full overflow-hidden rounded-full bg-line ${
          size === "lg" ? "h-3" : "h-2"
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            tone === "teal" ? "bg-teal" : "bg-primary"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
