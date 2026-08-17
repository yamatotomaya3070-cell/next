/**
 * 練習台本 → レンダリング入力への変換（純粋関数、Stage4配線）。
 *
 * 既存の音声生成 generateVoices(tts.ts) は AudioScene[] + VoiceProfile[] を受け取る。
 * スタイルガイドの話者(characters)を VoiceProfile に、台本セグメントを AudioScene に写す。
 * これにより、練習台本でも既存のTTS（Gemini/VOICEVOX/SAPI）をそのまま使える。
 *
 * 素材クリップ(clip_NNN.mp4)は「テロップ無し・立ち絵＋音声のみ」で出力する
 * （テロップ付けは就労者の練習作業なので、素材には焼き込まない）。
 */

import type { AudioScene, VoiceProfile } from "@/lib/video/templates";
import type { StyleGuideContent } from "@/lib/style-guide/schema";
import type { GeneratedPracticeScript } from "./schema";

export interface PracticeRenderInputs {
  /** TTS入力（generateVoices にそのまま渡せる） */
  audioScenes: AudioScene[];
  /** 話者プロファイル（generateVoices にそのまま渡せる） */
  voiceProfiles: VoiceProfile[];
  /** セグメントID → 素材クリップのファイル名 / 話者キー / must判定 */
  clips: Array<{
    segmentId: string;
    order: number;
    filename: string;
    speakerKey: string;
    isMust: boolean;
  }>;
}

function clipFilename(order: number): string {
  return `clip_${String(order).padStart(3, "0")}.mp4`;
}

/** スタイルガイドの話者を VoiceProfile 配列にする（TTSの声の割り当て順＝配列順） */
export function practiceVoiceProfiles(styleGuide: StyleGuideContent): VoiceProfile[] {
  return styleGuide.characters.map((c) => ({
    id: c.key,
    label: c.name,
    subtitleColor: c.subtitleColor,
    pitchFactor: 1.0, // 声の差はTTSプリセット（配列順）で付けるため既定
    rate: 0,
  }));
}

/** 練習台本＋スタイルガイドを、音声生成＋クリップ出力に必要な入力へ変換する */
export function practiceRenderInputs(
  script: GeneratedPracticeScript,
  styleGuide: StyleGuideContent,
): PracticeRenderInputs {
  const voiceProfiles = practiceVoiceProfiles(styleGuide);
  const validKeys = new Set(voiceProfiles.map((v) => v.id));
  const fallbackKey = voiceProfiles[0]?.id ?? "speaker_a";

  const audioScenes: AudioScene[] = script.segments.map((seg) => {
    const voiceId = validKeys.has(seg.speakerKey) ? seg.speakerKey : fallbackKey;
    const isSilence = seg.text.length === 0;
    return {
      id: seg.id,
      order: seg.order,
      narration: seg.text,
      voiceId,
      silenceSeconds: isSilence ? Math.max(2, seg.estimatedSeconds) : null,
    };
  });

  const clips = script.segments.map((seg) => ({
    segmentId: seg.id,
    order: seg.order,
    filename: clipFilename(seg.order),
    speakerKey: validKeys.has(seg.speakerKey) ? seg.speakerKey : fallbackKey,
    isMust: seg.priority === "must",
  }));

  return { audioScenes, voiceProfiles, clips };
}
