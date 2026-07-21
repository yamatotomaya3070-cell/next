import { IconVideo } from "@/components/ui/icons";

/* サムネイル画像はDBに項目が無いため、案件IDから決まるグラデーションで代替表示する。
   TODO: tasks にサムネイルURLが追加されたら画像表示に差し替える */
const GRADIENTS = [
  "from-sky-400 to-blue-600",
  "from-teal-400 to-emerald-600",
  "from-indigo-400 to-violet-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-sky-600",
];

interface TaskThumbProps {
  taskId: string;
  size?: "sm" | "lg";
  className?: string;
}

/** 案件のサムネイル（プレースホルダー） */
export function TaskThumb({ taskId, size = "sm", className = "" }: TaskThumbProps) {
  let hash = 0;
  for (const ch of taskId) hash = (hash * 31 + ch.codePointAt(0)!) % 9973;
  const gradient = GRADIENTS[hash % GRADIENTS.length];

  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${gradient} ${
        size === "lg" ? "h-36" : "h-24"
      } ${className}`}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-white/25">
        <IconVideo className="size-6 text-white" />
      </span>
    </div>
  );
}
