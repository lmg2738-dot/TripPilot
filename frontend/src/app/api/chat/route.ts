import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/api-helpers";
import { requireSupabase } from "@/lib/supabase";
import { chatReply } from "@/lib/services/trip-ai";

export async function POST(req: NextRequest) {
  const sessionId = req.headers.get("X-Session-Id");
  const user = await getUser(sessionId);
  if (!user) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

  const body = await req.json();
  let tripContext: Record<string, unknown> | undefined;

  if (body.trip_id) {
    const db = requireSupabase();
    const { data: trip } = await db.from("trips").select("itinerary").eq("id", body.trip_id).eq("owner_id", user.id).single();
    if (trip) tripContext = trip.itinerary as Record<string, unknown>;
  }

  const result = await chatReply(body.message, tripContext);
  return NextResponse.json(result);
}
