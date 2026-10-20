// カット練習の案件の、アプリに出す文（依頼書・台本・納品前チェックリスト）を作る。
//   実際のお仕事の依頼書と同じように「何をしてほしいか」と「納品の形」を書き、やり方は教科書のレッスン（src/lib/guide/lessons）にまかせる。
import type { EditKey, RawManifest } from "./buildRawPackage";

export interface RawAppTask {
  task: {
    title: string;
    summary: string;
    difficulty: number;
    skill_tags: string[];
    estimated_minutes: number;
    due_in_days: number;
  };
  requestDoc: string;
  script: string;
  checklist: string[];
  spec: RawManifest["spec"];
}

/** 作業時間の目安（はじめての人が、完成1分あたり40分くらい） */
const MINUTES_PER_VIDEO_MINUTE = 40;
const FILE_NAME = "video_名前.mp4";

export function buildRawAppTask(m: RawManifest, key: EditKey): RawAppTask {
  const videoMin = (m.sampleDurationSec ?? m.totalCleanSec) / 60;
  const lenText = `約${videoMin.toFixed(1)}分`;
  const rawMin = key.scenes.reduce((n, s) => n + s.durationSec, 0) / 60;
  const topic = m.theme || m.title;

  const requestDoc = `## お仕事の依頼書

お世話になります。お金の制度をやさしく解説する YouTube 動画の編集をお願いします。
録ったままの声と、場面ごとの映像をお渡しします。カット・テロップ・BGM と効果音まで仕上げてください。

### 動画について
- タイトル: ${m.title}
- 形: 横型（16:9）の YouTube 解説動画。ハルとミナ先生の会話で進みます
- 見る人: お金のことにくわしくない方。スマホで見る方が多いです
- 使う道具: DaVinci Resolve（無料版）

### お渡しする素材
- 台本.txt（正しい文です。テロップはここから作ってください）
- 場面ごとの声（${key.scenes.length}本・合わせて約${rawMin.toFixed(1)}分。録ったままなので、言いよどみ・言い直し・長い沈黙が入っています）
- 場面ごとの映像（文字なし）、オープニング・エンディングの映像
- BGM の候補2曲、効果音6種類

### やってほしいこと
1. カット：録り始め・録り終わりの声と沈黙、「えー」などの言いよどみ、言いまちがえた所、長い沈黙を消してください。文と文の間は 0.2〜0.3秒くらい、話題が変わる所は 0.5〜1秒くらいにしてください
2. 映像：最初にオープニング、最後にエンディングを入れ、場面ごとの映像をその場面の声に合わせて並べてください。映像が声より短いときは、静止画でのばしてください
3. 字幕：話した言葉を全部、画面の下に出してください。台本の文を使い、1行18文字くらいまで・2行まで・句読点なしでお願いします。見た目は、白い文字・黒い縁取り（太さ4）・画面の下の真ん中で、フォントは Yu Gothic UI（Mac はヒラギノ角ゴシック）にしてください
4. 強調テロップ：大事な数字や結論を、画面の上に大きく出してください。30秒に1〜2回くらい、10文字くらいまでにしてください
5. BGM：2曲から1曲えらんで、最初から最後まで流してください。声のじゃまにならない大きさにし、最後はフェードアウトしてください
6. 効果音：強調テロップが出る所などに入れてください。鳴らしすぎないようにお願いします
7. 声：場面によって声の大きさがちがう所があれば、そろえてください

### 納品のしかた
- 長さ: ${lenText}くらい（カットのしかたで前後してかまいません）
- 大きさ: ${m.spec.width}×${m.spec.height} / ${m.spec.fps}fps / ${m.spec.format}
- ファイル名: 「${FILE_NAME}」
- 「提出」タブから送ってください

### 注意事項
- お渡しした素材以外の画像や音楽は使わないでください
- 数字や制度（税率・非課税枠など）は台本のとおりにしてください。内容は変えないでください
- 分からないことがあれば、作業の途中でも遠慮なく質問してください`;

  const script = m.scenes
    .map((s) => [`■ 場面${s.no}（${s.typeJa}）　声：${s.audio.split("/").pop()}`, ...s.lines.map((l) => `${l.speakerJa}：${l.text}`)].join("\n"))
    .join("\n\n");

  const checklist = [
    "録り始め・録り終わりの声、「えー」などの言いよどみ、言いまちがえた所、長い沈黙が残っていない",
    "言葉の頭や終わりが欠けている所がない",
    "映像のない黒い所や、すき間がない（オープニングとエンディングも入っている）",
    "話した言葉に全部字幕が付き、台本と同じ文で、声と同時に出て同時に消える",
    "テロップに誤字・ぬけがない（3回読んだ）",
    "強調テロップは大事な所だけで、見た目がそろっている",
    "BGM が声のじゃまをしていない。最後はフェードアウトして終わる",
    "効果音がうるさくなく、テロップと同じタイミングで鳴る",
    "声の大きさがそろっていて、音がわれている所がない",
    `書き出した動画が ${m.spec.width}x${m.spec.height} / ${m.spec.fps}fps になっている`,
  ];

  return {
    task: {
      title: m.title,
      summary: `「${topic}」の解説動画を、録ったままの声と映像から仕上げるお仕事です。カット・字幕と強調テロップ・BGM と効果音・声の大きさの調整まで行います。`,
      difficulty: 3,
      skill_tags: ["cut", "telop", "bgm", "se", "audio", "export"],
      estimated_minutes: Math.max(120, Math.round((videoMin * MINUTES_PER_VIDEO_MINUTE) / 30) * 30),
      due_in_days: 7,
    },
    requestDoc,
    script,
    checklist,
    spec: m.spec,
  };
}
