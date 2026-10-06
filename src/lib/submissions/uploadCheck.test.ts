import { describe, expect, test } from "vitest";
import {
  checkSubmissionSize,
  describeUploadError,
  storagePathName,
} from "./uploadCheck";

const MB = 1024 * 1024;

describe("checkSubmissionSize", () => {
  test("上限以下なら null を返す", () => {
    expect(checkSubmissionSize(49 * MB, 50)).toBeNull();
    expect(checkSubmissionSize(50 * MB, 50)).toBeNull();
  });

  test("上限を超えると、大きさと上限と直し方を伝える", () => {
    const message = checkSubmissionSize(120.4 * MB, 50);
    expect(message).toContain("120.4 MB");
    expect(message).toContain("50 MB");
    expect(message).toContain("絆_YouTube_720p");
  });

  test("0バイトのファイルは中身が無いと伝える", () => {
    expect(checkSubmissionSize(0, 50)).toContain("中身");
  });
});

describe("describeUploadError", () => {
  test("413 は大きすぎるという案内にする", () => {
    expect(describeUploadError({ statusCode: "413", message: "Payload too large" }, 50)).toContain(
      "大きすぎ",
    );
  });

  test("Storage の上限超過メッセージも大きすぎる扱いにする", () => {
    expect(
      describeUploadError({ message: "The object exceeded the maximum allowed size" }, 50),
    ).toContain("大きすぎ");
  });

  test("権限エラーはログインし直しを案内する", () => {
    expect(
      describeUploadError({ statusCode: "403", message: "new row violates row-level security policy" }, 50),
    ).toContain("ログイン");
  });

  test("通信エラーはネットワークを案内する", () => {
    expect(describeUploadError(new TypeError("Failed to fetch"), 50)).toContain("インターネット");
  });

  test("その他は元のメッセージを職員向けに添える", () => {
    const message = describeUploadError({ message: "something odd" }, 50);
    expect(message).toContain("もう一度");
    expect(message).toContain("something odd");
  });
});

describe("storagePathName", () => {
  test("英数字のファイル名はそのまま使う", () => {
    expect(storagePathName("nisa_hanako.mp4")).toBe("nisa_hanako.mp4");
  });

  test("日本語や空白は _ にまとめ、拡張子は残す", () => {
    expect(storagePathName("新NISA 完成動画（2）.mp4")).toBe("_NISA_2_.mp4");
  });

  test("全部が日本語でも空にならない", () => {
    expect(storagePathName("完成動画.MP4")).toBe("video.mp4");
  });

  test("拡張子が無ければ mp4 を付ける", () => {
    expect(storagePathName("完成動画")).toBe("video.mp4");
  });
});
