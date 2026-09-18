import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "@/lib/types";
import { describeMessagesError } from "./errors";
import { buildRooms, type ChatRoom } from "./rooms";

/** トーク画面で最初に表示する件数（それより古い分は今のところ読み込まない） */
const THREAD_LIMIT = 200;
/** ルーム一覧の「最後のメッセージ」を決めるために見る件数 */
const RECENT_LIMIT = 300;

export interface ThreadData {
  messages: ChatMessage[];
  /** 吹き出しに「案件: ○○」を出すための対応表 */
  assignmentTitles: Record<string, string>;
}

/** 案件IDから案件名の対応表を引く（メッセージに紐づく分だけ） */
async function loadAssignmentTitles(
  supabase: SupabaseClient,
  assignmentIds: string[],
): Promise<Record<string, string>> {
  if (assignmentIds.length === 0) return {};
  const { data } = await supabase
    .from("task_assignments")
    .select("id, tasks(title)")
    .in("id", assignmentIds);
  const rows = (data ?? []) as unknown as {
    id: string;
    tasks: { title: string } | null;
  }[];
  return Object.fromEntries(
    rows.filter((r) => r.tasks?.title).map((r) => [r.id, r.tasks!.title]),
  );
}

/** 1つのトーク（利用者1人分）を古い順で読み込む */
export async function loadThread(
  supabase: SupabaseClient,
  traineeId: string,
): Promise<{ data: ThreadData | null; error: string | null }> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("trainee_id", traineeId)
    .order("created_at", { ascending: false })
    .limit(THREAD_LIMIT);
  if (error) return { data: null, error: describeMessagesError(error) };

  const messages = (data ?? []).reverse() as ChatMessage[];
  const assignmentIds = [
    ...new Set(
      messages.map((m) => m.assignment_id).filter((v): v is string => !!v),
    ),
  ];
  const assignmentTitles = await loadAssignmentTitles(supabase, assignmentIds);
  return { data: { messages, assignmentTitles }, error: null };
}

/** 職員向け: 利用者ごとのルーム一覧（最終メッセージ・未読数つき） */
export async function loadRooms(
  supabase: SupabaseClient,
): Promise<{ rooms: ChatRoom[]; error: string | null }> {
  const [traineesRes, recentRes, unreadRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("role", "trainee")
      .order("display_name"),
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("messages")
      .select("trainee_id")
      .eq("sender_kind", "trainee")
      .is("read_at", null),
  ]);

  if (traineesRes.error) {
    return { rooms: [], error: "利用者の一覧を読み込めませんでした。" };
  }
  if (recentRes.error) {
    return { rooms: [], error: describeMessagesError(recentRes.error) };
  }

  const rooms = buildRooms(
    (traineesRes.data ?? []) as { id: string; display_name: string }[],
    (recentRes.data ?? []) as ChatMessage[],
    ((unreadRes.data ?? []) as { trainee_id: string }[]).map(
      (r) => r.trainee_id,
    ),
  );
  return { rooms, error: null };
}
