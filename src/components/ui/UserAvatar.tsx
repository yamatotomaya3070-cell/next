const AVATAR_COLORS = [
  "bg-primary-soft text-primary-dark",
  "bg-teal-soft text-teal",
  "bg-accent-purple-soft text-accent-purple",
  "bg-warning-soft text-warning",
  "bg-success-soft text-success",
];

interface UserAvatarProps {
  name: string;
  size?: "sm" | "md";
}

/** 名前の頭文字を表示するアバター（画像項目はDBに無いためイニシャル表示） */
export function UserAvatar({ name, size = "md" }: UserAvatarProps) {
  const initial = name.trim().charAt(0) || "?";
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 997;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${color} ${
        size === "sm" ? "size-8 text-sm" : "size-10 text-base"
      }`}
    >
      {initial}
    </span>
  );
}
