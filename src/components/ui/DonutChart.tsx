interface DonutChartProps {
  percent: number;
  size?: number;
  label?: string;
}

/** 進捗率のドーナツチャート（中央に数値を併記して色だけに頼らない） */
export function DonutChart({ percent, size = 120, label }: DonutChartProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;

  return (
    <div
      role="img"
      aria-label={`${label ?? "進捗"} ${clamped}%`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>
      <span className="absolute text-center leading-tight">
        <span className="block text-2xl font-bold text-ink">{clamped}%</span>
      </span>
    </div>
  );
}
