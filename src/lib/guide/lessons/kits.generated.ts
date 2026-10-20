// scripts/practice/buildPracticeKits.ts が作るファイル。手で書きかえない。
export const PRACTICE_KITS = {
  "dv-basics": { href: "/guide/practice/dv-basics.zip", label: "段1の練習素材（30秒）", size: "1.6MB" },
  "cut-basics": { href: "/guide/practice/cut-basics.zip", label: "2-1 の練習素材（ピーの音が3回入った声）", size: "892KB" },
  "cut-remove": { href: "/guide/practice/cut-remove.zip", label: "2-2 の練習素材（録ったままの声・約1分）", size: "2.5MB" },
  "cut-ma": { href: "/guide/practice/cut-ma.zip", label: "2-3 の練習素材（長い沈黙が残った声）", size: "1.6MB" },
  "place-video": { href: "/guide/practice/place-video.zip", label: "2-4 の練習素材（3場面の映像と声）", size: "4.2MB" },
  "place-character": { href: "/guide/practice/place-character.zip", label: "2-5 の練習素材（図の場面と立ち絵）", size: "3.4MB" },
  "sub-practice": { href: "/guide/practice/sub-practice.zip", label: "2-6・2-7 の練習素材（声3本と依頼書）", size: "731KB" },
  "finish-practice": { href: "/guide/practice/finish-practice.zip", label: "2-8〜2-10 の練習素材（1分の動画・BGM・効果音）", size: "4.6MB" },
  "voice-level": { href: "/guide/practice/voice-level.zip", label: "2-11 の練習素材（大きさのちがう声）", size: "1.9MB" },
  "final-check": { href: "/guide/practice/final-check.zip", label: "2-12 の練習素材（誤字が3つある動画）", size: "1.1MB" },
} as const;

export type PracticeKitId = keyof typeof PRACTICE_KITS;
