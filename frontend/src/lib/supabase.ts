import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = env.supabaseUrl();
  const key = env.supabaseAnonKey();
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export function requireSupabase(): SupabaseClient {
  const db = getSupabase();
  if (!db) throw new Error("Supabase가 설정되지 않았습니다.");
  return db;
}
