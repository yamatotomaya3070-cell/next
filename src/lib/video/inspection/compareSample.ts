import type { CheckItem, ProbeResult } from "./types";

/**
 * 完成見本の実測値と提出動画の実測値を突き合わせる（正解データ表を持たない案件用）。
 *
 * SCENE案件は task_materials(kind=sample) に完成見本があるだけで、video_jobs のような
 * 正解データ(answer_data)を持たない。そこで「見本そのものを実測した値」を期待値にする。
 * 見本と同じ素材から同じ手順で作れば一致するはずの項目だけを比べる。
 */

/** 尺の許容差（秒）。DaVinci の書き出し誤差やフェードの端数を吸収する */
export const SAMPLE_DURATION_TOLERANCE_SEC = 2.0;
/** 平均音量の許容差（dB）。BGMの混ぜ方の個人差は許し、声の欠落や音割れ級のズレだけを拾う */
export const SAMPLE_VOLUME_TOLERANCE_DB = 6.0;

export function compareProbeToSample(submission: ProbeResult, sample: ProbeResult): CheckItem[] {
  return [
    checkDuration(submission, sample),
    checkResolution(submission, sample),
    checkVideoStream(submission),
    checkAudioStream(submission),
    checkVolume(submission, sample),
  ];
}

function checkDuration(sub: ProbeResult, sample: ProbeResult): CheckItem {
  const diff = Math.abs(sub.durationSec - sample.durationSec);
  return {
    key: "duration",
    label: "完成尺",
    status: diff <= SAMPLE_DURATION_TOLERANCE_SEC ? "pass" : "fail",
    expected: `${sample.durationSec.toFixed(1)}秒 ±${SAMPLE_DURATION_TOLERANCE_SEC}秒`,
    actual: `${sub.durationSec.toFixed(1)}秒`,
  };
}

function checkResolution(sub: ProbeResult, sample: ProbeResult): CheckItem {
  if (sample.width === null || sample.height === null) {
    return {
      key: "resolution",
      label: "解像度",
      status: "unknown",
      expected: "見本から取得できませんでした",
      actual: "－",
    };
  }
  const expected = `${sample.width}x${sample.height}`;
  if (sub.width === null || sub.height === null) {
    return { key: "resolution", label: "解像度", status: "unknown", expected, actual: "取得できませんでした" };
  }
  return {
    key: "resolution",
    label: "解像度",
    status: sub.width === sample.width && sub.height === sample.height ? "pass" : "fail",
    expected,
    actual: `${sub.width}x${sub.height}`,
  };
}

function checkVideoStream(sub: ProbeResult): CheckItem {
  return {
    key: "video_stream",
    label: "映像トラック",
    status: sub.hasVideo ? "pass" : "fail",
    expected: "あり",
    actual: sub.hasVideo ? "あり" : "なし",
  };
}

function checkAudioStream(sub: ProbeResult): CheckItem {
  return {
    key: "audio_stream",
    label: "音声トラック",
    status: sub.hasAudio ? "pass" : "fail",
    expected: "あり",
    actual: sub.hasAudio ? "あり" : "なし",
  };
}

function checkVolume(sub: ProbeResult, sample: ProbeResult): CheckItem {
  if (sample.meanVolumeDb === null) {
    return {
      key: "volume",
      label: "音量",
      status: "unknown",
      expected: "見本から取得できませんでした",
      actual: "－",
    };
  }
  const expected = `${sample.meanVolumeDb.toFixed(1)}dB ±${SAMPLE_VOLUME_TOLERANCE_DB}dB`;
  if (sub.meanVolumeDb === null) {
    return { key: "volume", label: "音量", status: "unknown", expected, actual: "取得できませんでした" };
  }
  const diff = Math.abs(sub.meanVolumeDb - sample.meanVolumeDb);
  return {
    key: "volume",
    label: "音量",
    status: diff <= SAMPLE_VOLUME_TOLERANCE_DB ? "pass" : "fail",
    expected,
    actual: `${sub.meanVolumeDb.toFixed(1)}dB`,
  };
}
