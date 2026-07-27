import type { TemplateAnswerData, VideoTemplateConfig } from "../templates/types";
import type { CheckItem, ProbeResult } from "./types";

/** 提出動画の実測値(ProbeResult)を正解データ(answer_data)と突き合わせ、項目別の pass/fail/unknown を返す */
export function compareProbeToAnswer(
  probe: ProbeResult,
  answerData: TemplateAnswerData,
  templateConfig: VideoTemplateConfig,
): CheckItem[] {
  return [
    checkDuration(probe, answerData),
    checkResolution(probe, templateConfig),
    checkVideoStream(probe),
    checkAudioStream(probe),
    checkVolume(probe, answerData),
  ];
}

function checkDuration(probe: ProbeResult, answerData: TemplateAnswerData): CheckItem {
  const diff = Math.abs(probe.durationSec - answerData.totalDurationSec);
  return {
    key: "duration",
    label: "完成尺",
    status: diff <= answerData.toleranceSec ? "pass" : "fail",
    expected: `${answerData.totalDurationSec}秒 ±${answerData.toleranceSec}秒`,
    actual: `${probe.durationSec.toFixed(1)}秒`,
  };
}

function checkResolution(probe: ProbeResult, templateConfig: VideoTemplateConfig): CheckItem {
  const expected = `${templateConfig.width}x${templateConfig.height}`;
  if (probe.width === null || probe.height === null) {
    return { key: "resolution", label: "解像度", status: "unknown", expected, actual: "取得できませんでした" };
  }
  const actual = `${probe.width}x${probe.height}`;
  return {
    key: "resolution",
    label: "解像度",
    status: probe.width === templateConfig.width && probe.height === templateConfig.height ? "pass" : "fail",
    expected,
    actual,
  };
}

function checkVideoStream(probe: ProbeResult): CheckItem {
  return {
    key: "video_stream",
    label: "映像トラック",
    status: probe.hasVideo ? "pass" : "fail",
    expected: "あり",
    actual: probe.hasVideo ? "あり" : "なし",
  };
}

function checkAudioStream(probe: ProbeResult): CheckItem {
  return {
    key: "audio_stream",
    label: "音声トラック",
    status: probe.hasAudio ? "pass" : "fail",
    expected: "あり",
    actual: probe.hasAudio ? "あり" : "なし",
  };
}

function checkVolume(probe: ProbeResult, answerData: TemplateAnswerData): CheckItem {
  const { min, max } = answerData.volumeTargetDb;
  const expected = `${min}dB〜${max}dB`;
  if (probe.meanVolumeDb === null) {
    return { key: "volume", label: "音量", status: "unknown", expected, actual: "取得できませんでした" };
  }
  return {
    key: "volume",
    label: "音量",
    status: probe.meanVolumeDb >= min && probe.meanVolumeDb <= max ? "pass" : "fail",
    expected,
    actual: `${probe.meanVolumeDb.toFixed(1)}dB`,
  };
}
