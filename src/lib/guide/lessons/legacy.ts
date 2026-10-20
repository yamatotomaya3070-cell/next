/**
 * 2026-10-20 より前の教科書（章と節）の参照 "章slug#節id" を、今のレッスンへ読みかえる。
 * 以前に作った案件の手順（DB の manual_steps.guide）にこの形の参照が残っているので、リンクを切らさないために置く。
 * 新しく書く参照は、レッスンの slug をそのまま使う。
 */
const BY_SECTION: Record<string, string> = {
  "screen#map": "dv-screen",
  "screen#keys": "pc-keys",
  "screen#titles": "sub-style",
  "subtitles#length": "sub-all",
  "subtitles#text": "sub-all",
  "subtitles#custom-copy": "sub-all",
  "export#submit": "pc-submit",
  "export#check": "final-check",
  "trouble#undo": "pc-keys",
  "trouble#shifted": "cut-basics",
  "trouble#crash": "dv-project",
  "cut#ma": "cut-ma",
  "cut#smooth": "cut-ma",
  "cut#image": "place-video",
  "telop-make#emphasis": "telop",
  "telop-make#look": "telop",
  "telop-make#typo": "final-check",
  "bgm-se#se": "se",
  "bgm-se#se-timing": "se",
  "final-check#send": "job-deliver",
  "final-check#fix": "job-fix",
};

const BY_CHAPTER: Record<string, string> = {
  screen: "dv-screen",
  project: "dv-project",
  import: "dv-import",
  arrange: "place-video",
  subtitles: "sub-style",
  telop: "telop",
  audio: "bgm",
  export: "dv-export",
  cut: "cut-remove",
  "telop-make": "sub-all",
  "bgm-se": "bgm",
  voice: "voice-level",
  "final-check": "final-check",
};

/** 古い参照ならレッスンの slug を、そうでなければ null を返す */
export function legacyLessonSlug(ref: string): string | null {
  if (BY_SECTION[ref]) return BY_SECTION[ref];
  const chapter = ref.split("#")[0];
  return BY_CHAPTER[chapter] ?? null;
}
