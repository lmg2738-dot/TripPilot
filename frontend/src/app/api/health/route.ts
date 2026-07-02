import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "TripPilot AI",
    checks: {
      supabase_url: Boolean(env.supabaseUrl()),
      supabase_anon_key: Boolean(env.supabaseAnonKey()),
      openrouter_api_key: Boolean(env.openrouterApiKey()),
      public_data_api_key: Boolean(env.publicDataApiKey()),
      ex_api_key: Boolean(env.exApiKey()),
      free_trip_limit: env.freeTripLimit(),
    },
  });
}
