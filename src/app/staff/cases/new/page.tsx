import { requireRole } from "@/lib/supabase/server";
import { RealCaseForm } from "./RealCaseForm";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  await requireRole("staff", "admin");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">実案件から練習案件を生成する</h1>
      <p className="mt-2 text-slate-600">
        実際に届いた案件の依頼文を貼り付けると、AIが固有名詞を匿名化した上で、
        同じスキル・同じ要求水準の「類似の練習案件」（依頼書・手順書・台本・
        修正指示・完成見本の説明）を下書きします。
      </p>
      <p className="mt-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
        ⚠️ 実案件の依頼文はこの生成にのみ使用し、匿名化前のテキストは保存されません。
        NDA・守秘義務のある案件は、依頼者の許諾範囲を確認してから使用してください。
      </p>
      <div className="mt-6">
        <RealCaseForm />
      </div>
    </div>
  );
}
