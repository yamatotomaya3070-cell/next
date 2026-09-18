import { redirect } from "next/navigation";

/**
 * 練習案件は「YouTube動画生成」（/staff/scene）だけで作る。
 * そこで作った案件は、登録前に「支給素材から完成見本が作れるか」を確かめてある
 * （scripts/scene/verifyPackage.ts）。文章だけの AI 課題の生成はやめたので、ここは転送だけ。
 */
export default function NewTaskPage() {
  redirect("/staff/scene");
}
