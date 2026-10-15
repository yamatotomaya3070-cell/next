import type { CheckItem, ProbeResult } from "./types";

/**
 * 完成見本の実測値と提出動画の実測値を突き合わせる（正解データ表を持たない案件用）。
 *
 * SCENE案件は task_materials(kind=sample) に完成見本があるだけで、video_jobs のような
 * 正解データ(answer_data)を持たない。そこで「見本そのものを実測した値」を期待値にする。
 * 見本と同じ素材から同じ手順で作れば一致するはずの項目だけを比べる。
 */

/** 尺の許容差（秒）の下限。DaVinci の書き出し誤差やフェードの端数を吸収する */
export const SAMPLE_DURATION_TOLERANCE_SEC = 2.0;
/**
 * 尺の許容差の割合。セリフを手で並べると、つなぎ目ごとに数フレームずつ差が出て長い動画ほど積み重なる。
 * 固定の ±2秒 では手で並べた動画がほぼ差し戻されたため、見本の長さに比例させる（5分で ±6秒）。
 */
export const SAMPLE_DURATION_TOLERANCE_RATIO = 0.02;

export function durationToleranceSec(sampleSec: number): number {
  return Math.max(SAMPLE_DURATION_TOLERANCE_SEC, sampleSec * SAMPLE_DURATION_TOLERANCE_RATIO);
}
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
  const tolerance = durationToleranceSec(sample.durationSec);
  const diff = sub.durationSec - sample.durationSec;
  const pass = Math.abs(diff) <= tolerance;
  const item: CheckItem = {
    key: "duration",
    label: "完成尺",
    status: pass ? "pass" : "fail",
    expected: `${sample.durationSec.toFixed(1)}秒 ±${tolerance.toFixed(1)}秒`,
    actual: `${sub.durationSec.toFixed(1)}秒`,
  };
  if (pass) return item;
  const gap = Math.abs(diff).toFixed(1);
  return {
    ...item,
    message:
      diff < 0
        ? `動画が見本より ${gap}秒 短くなっています（あなたの動画: ${sub.durationSec.toFixed(1)}秒 / 見本: ${sample.durationSec.toFixed(1)}秒）。セリフとセリフの間が詰まっていないか、作業指示一覧の「空ける間」「置く位置」とくらべてください。最後の場面やエンディングが切れていないかも確かめてください。`
        : `動画が見本より ${gap}秒 長くなっています（あなたの動画: ${sub.durationSec.toFixed(1)}秒 / 見本: ${sample.durationSec.toFixed(1)}秒）。セリフの間が空きすぎていないか、作業指示一覧の「空ける間」「置く位置」とくらべてください。エンディングのあとに余分なものが残っていないかも確かめてください。`,
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
