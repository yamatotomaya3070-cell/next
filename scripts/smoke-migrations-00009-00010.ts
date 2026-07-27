/**
 * migration 00009(ai_usage_logs) / 00010(production_transfer_approvals) の
 * 適用後スモークテスト。ブラウザ不要。
 *
 * 実コードと同じ列・同じ読み取りクエリで round-trip し、テーブル定義とコードの
 * 想定（列名・NOT NULL・読み取り形状）が一致しているか確認する。
 * 作成したテストデータは最後に必ず削除する。
 *
 * 実行: npx tsx scripts/smoke-migrations-00009-00010.ts
 */
import { loadEnvLocal } from "./video/env";
import { getSupabaseAdmin } from "./video/supabaseAdmin";

loadEnvLocal();

async function main(): Promise<void> {
  const db = getSupabaseAdmin();
  let failures = 0;
  const ok = (label: string) => console.log(`  ✅ ${label}`);
  const ng = (label: string, detail?: unknown) => {
    failures += 1;
    console.error(`  ❌ ${label}`, detail ?? "");
  };

  // ---------- 00009: ai_usage_logs ----------
  console.log("[00009] ai_usage_logs");
  {
    // logAiUsage(gemini.ts) と同じ列でサービスロール INSERT
    const { data, error } = await db
      .from("ai_usage_logs")
      .insert({
        provider: "gemini",
        model: "smoke-test-model",
        kind: "task",
        prompt_tokens: 111,
        output_tokens: 222,
        total_tokens: 333,
      })
      .select("id, provider, model, kind, total_tokens")
      .single();

    if (error || !data) {
      ng("INSERT できない（テーブル/列を確認）", error);
    } else {
      ok("サービスロール INSERT 成功");
      if (data.kind === "task" && data.total_tokens === 333) ok("列の読み戻し一致");
      else ng("読み戻し値が不一致", data);
      await db.from("ai_usage_logs").delete().eq("id", data.id);
      ok("テストデータ削除");
    }
  }

  // ---------- 00010: production_transfer_approvals ----------
  console.log("[00010] production_transfer_approvals");
  {
    // FK 用に実在する trainee を1人取得
    const { data: trainee } = await db
      .from("profiles")
      .select("id, display_name")
      .eq("role", "trainee")
      .limit(1)
      .maybeSingle();

    if (!trainee) {
      console.log("  ⏭  trainee が存在しないため FK 挿入テストはスキップ");
      // テーブル存在だけは確認
      const { error } = await db
        .from("production_transfer_approvals")
        .select("id")
        .limit(1);
      if (error) ng("テーブルが読めない", error);
      else ok("テーブル存在を確認");
    } else {
      const userId = trainee.id as string;
      const createdIds: string[] = [];

      // recordTransferApproval と同じ列で承認行 INSERT
      const first = await db
        .from("production_transfer_approvals")
        .insert({
          user_id: userId,
          decision: "approved",
          note: "smoke-test 承認",
          approved_by: null,
        })
        .select("id")
        .single();
      if (first.error || !first.data) {
        ng("承認行 INSERT 失敗", first.error);
      } else {
        createdIds.push(first.data.id as string);
        ok("承認行 INSERT 成功");

        // page.tsx と同じ読み取り（最新1件）
        const latest = await db
          .from("production_transfer_approvals")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);
        const row = (latest.data ?? [])[0] as
          | { decision?: string }
          | undefined;
        if (row?.decision === "approved") ok("最新行の読み取り形状・値が一致（承認）");
        else ng("最新行が期待と不一致", latest.data);

        // decision の CHECK 制約（不正値を弾くか）
        const bad = await db
          .from("production_transfer_approvals")
          .insert({ user_id: userId, decision: "bogus" });
        if (bad.error) ok("decision CHECK 制約が有効（不正値を拒否）");
        else ng("decision に不正値が入ってしまう（CHECK 制約を確認）");
      }

      // クリーンアップ（作成した行のみ削除）
      if (createdIds.length > 0) {
        await db
          .from("production_transfer_approvals")
          .delete()
          .in("id", createdIds);
        ok("テストデータ削除");
      }
    }
  }

  console.log("");
  if (failures === 0) {
    console.log("✅ すべてのスモークチェックに合格しました。");
  } else {
    console.error(`❌ ${failures} 件の不一致があります。上記を確認してください。`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("スモークテストが例外で終了:", err);
  process.exitCode = 1;
});
