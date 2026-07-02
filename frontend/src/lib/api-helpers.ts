import { requireSupabase } from "@/lib/supabase";

export async function getUser(sessionId: string | null) {
  if (!sessionId) return null;
  const db = requireSupabase();

  const { data: existing } = await db.from("users").select().eq("session_id", sessionId).single();
  if (existing) return existing;

  const { data: created } = await db
    .from("users")
    .insert({ session_id: sessionId, name: "여행자" })
    .select()
    .single();
  return created;
}
