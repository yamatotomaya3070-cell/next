"use server";

import { revalidatePath } from "next/cache";
import { requireRole, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveStyleGuide } from "./styleGuide";
import { generateCharacterExpressionSet } from "@/lib/image-gen";
import {
  CHARACTER_ASSET_BUCKET,
  characterAssetStoragePath,
  type CharacterAssetRecord,
} from "@/lib/character-assets/schema";
import type { ActionState } from "./assignments";

/**
 * 立ち絵アセットの生成（Stage3）。
 * 現在有効なスタイルガイドの全キャラ × 全表情を生成し、Storage 保存＋DB upsert する。
 * 画像生成は Gemini（GEMINI_API_KEY）、失敗・未設定は mock にフォールバック。
 *
 * 注意: 実Gemini生成はキャラ数×表情数ぶんの画像APIを呼ぶため時間がかかる。
 * サーバーレスの実行時間上限に注意（mock は高速）。
 */

export interface GenerateCharacterAssetsState extends ActionState {
  generatedCount?: number;
  providerSummary?: string;
}

export async function generateCharacterAssetsAction(
  _prev: GenerateCharacterAssetsState,
  formData: FormData,
): Promise<GenerateCharacterAssetsState> {
  void formData; // useActionState の契約で受け取るが、この操作では使わない
  await requireRole("staff", "admin");

  const guide = await getActiveStyleGuide();
  if (!guide) {
    return { error: "有効なスタイルガイドがありません。先にスタイルガイドを確定してください。" };
  }

  const admin = createAdminClient();
  const content = guide.content;
  let generatedCount = 0;
  const providers = new Set<string>();

  try {
    for (const character of content.characters) {
      const images = await generateCharacterExpressionSet({
        characterKey: character.key,
        appearance: character.appearance,
        artStyle: content.artStyle,
        negativeStyle: content.negativeStyle,
        palette: {
          background: content.palette.background,
          primary: content.palette.primary,
          accent: content.palette.accent,
        },
        seed: character.seed,
      });

      for (const item of images) {
        providers.add(item.provider);
        const path = characterAssetStoragePath(guide.id, character.key, item.expression);

        const { error: uploadError } = await admin.storage
          .from(CHARACTER_ASSET_BUCKET)
          .upload(path, Buffer.from(item.image.bytes), {
            contentType: item.image.mimeType,
            upsert: true,
          });
        if (uploadError) {
          console.error("立ち絵アップロードに失敗:", uploadError);
          return {
            error:
              "立ち絵の保存に失敗しました。character-assets バケット（migration 00015）が未適用の可能性があります。",
          };
        }

        const { error: upsertError } = await admin.from("character_assets").upsert(
          {
            style_guide_id: guide.id,
            character_key: character.key,
            expression: item.expression,
            seed: character.seed,
            storage_path: path,
            mime_type: item.image.mimeType,
            provider: item.provider,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "style_guide_id,character_key,expression" },
        );
        if (upsertError) {
          console.error("立ち絵メタデータの保存に失敗:", upsertError);
          return {
            error:
              "立ち絵情報の保存に失敗しました。character_assets テーブル（migration 00015）が未適用の可能性があります。",
          };
        }
        generatedCount += 1;
      }
    }
  } catch (err) {
    console.error("立ち絵生成に失敗:", err);
    return { error: "立ち絵の生成に失敗しました。少し時間をおいて再度お試しください。" };
  }

  revalidatePath("/staff/style-guide");
  return {
    error: null,
    success: true,
    generatedCount,
    providerSummary: [...providers].join(", "),
  };
}

/** 指定スタイルガイドの立ち絵アセットを取得（職員のRLS scoped client） */
export async function getCharacterAssets(styleGuideId: string): Promise<CharacterAssetRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("character_assets")
    .select("*")
    .eq("style_guide_id", styleGuideId);
  return (data as CharacterAssetRecord[] | null) ?? [];
}

/** 指定アセットの署名付きURLを発行（職員プレビュー用） */
export async function getCharacterAssetSignedUrls(
  assets: CharacterAssetRecord[],
): Promise<Record<string, string>> {
  if (assets.length === 0) return {};
  const admin = createAdminClient();
  const map: Record<string, string> = {};
  for (const asset of assets) {
    const { data } = await admin.storage
      .from(CHARACTER_ASSET_BUCKET)
      .createSignedUrl(asset.storage_path, 60 * 60);
    if (data?.signedUrl) map[asset.id] = data.signedUrl;
  }
  return map;
}
