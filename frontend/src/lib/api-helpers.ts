import { requireSupabase } from "@/lib/supabase";

export async function getUser(sessionId: string | null) {
  if (!sessionId) return null;
  const db = requireSupabase();

  const { data: existing, error: existingError } = await db
    .from("users")
    .select()
    .eq("session_id", sessionId)
    .single();
  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(existingError.message);
  }
  if (existing) return existing;

  const { data: created, error: createdError } = await db
    .from("users")
    .insert({ session_id: sessionId, name: "여행자" })
    .select()
    .single();
  if (createdError) {
    throw new Error(createdError.message);
  }
  return created;
}
