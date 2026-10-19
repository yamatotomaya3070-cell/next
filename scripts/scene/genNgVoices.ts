// カット練習用の「消す声」（えー・あのー・言い直しの声・録り始めの声）を、話す人ごとに1回だけ作る。
//   テーマに関係しない声なので、作ったものを assets/voice_ng に置いて、どの案件でも使い回す。
//   使い方: npx tsx scripts/scene/genNgVoices.ts   （GEMINI_API_KEY が必要。あるファイルは作り直さない）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NG_CLIPS, NG_SPEAKERS, ngClipFile } from "@/lib/scene/rawTakes";

const OUT = "assets/voice_ng";
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
// render_project.mjs と同じ声
const VOICE: Record<string, string> = { narrator: "Charon", mina: "Kore", haru: "Puck" };

function loadKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const m = existsSync(".env.local") ? readFileSync(".env.local", "utf8").match(/^GEMINI_API_KEY\s*=\s*(.+)$/m) : null;
  if (!m) throw new Error("GEMINI_API_KEY がありません");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function synth(key: string, speaker: string, text: string, how: string): Promise<Buffer> {
  const prompt = `あなたは声優です。動画の収録中に、${how}。次の【読み上げ原稿】だけを、そのまま声にしてください。原稿にない言葉は加えないでください。\n【読み上げ原稿】\n${text}`;
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE[speaker] } } } },
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error(`tts ${r.status} ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error("音声が返ってきませんでした");
      return wav(Buffer.from(b64, "base64"), 24000);
    } catch (e) {
      if (a === 3) throw e;
      await new Promise((res) => setTimeout(res, 2 ** a * 1000));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const key = loadKey();
  mkdirSync(OUT, { recursive: true });
  for (const speaker of NG_SPEAKERS) {
    for (const clip of NG_CLIPS) {
      const file = `${OUT}/${ngClipFile(speaker, clip.id)}`;
      if (existsSync(file)) continue;
      writeFileSync(file, await synth(key, speaker, clip.text, clip.how));
      console.log(`作成: ${file}（${clip.text}）`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
