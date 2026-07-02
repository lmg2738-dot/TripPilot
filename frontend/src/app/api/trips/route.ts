import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/api-helpers";
import { env } from "@/lib/env";
import { requireSupabase } from "@/lib/supabase";
import { searchAttractions, getWeather, getTraffic, getKtxSchedule } from "@/lib/services/public-data";
import { generateItinerary, calculateBudget, TripPreferences } from "@/lib/services/trip-ai";

function nights(start: string, end: string) {
  return Math.max(Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000), 1);
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.headers.get("X-Session-Id");
    const user = await getUser(sessionId);
    if (!user) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

    if (user.plan_type === "free" && user.trip_count >= env.freeTripLimit()) {
      return NextResponse.json({ detail: `무료 플랜은 ${env.freeTripLimit()}회까지 가능합니다.` }, { status: 403 });
    }

    const body = await req.json();
    const prefs: TripPreferences = body.preferences ?? {};
    const dayCount = nights(body.start_date, body.end_date) + 1;

    const [attractions, weather, traffic, ktx] = await Promise.all([
      searchAttractions(body.destination),
      getWeather(body.destination, dayCount),
      getTraffic("서울", body.destination),
      getKtxSchedule("서울", body.destination, body.start_date),
    ]);

    const itinerary = await generateItinerary(
      body.destination, body.start_date, body.end_date, prefs, weather, attractions,
      `${traffic.congestion_level}, ${traffic.estimated_time_min}분`,
      ktx.map((k) => `${k.train_no} ${k.departure_time}`).join(", "),
    );

    const budget = calculateBudget(prefs, itinerary, nights(body.start_date, body.end_date));
    const db = requireSupabase();

    const { data: trip, error } = await db.from("trips").insert({
      owner_id: user.id,
      title: (itinerary.title as string) ?? `${body.destination} 여행`,
      destination: body.destination,
      start_date: body.start_date,
      end_date: body.end_date,
      preferences: prefs,
      itinerary,
      budget,
    }).select().single();

    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

    await db.from("users").update({ trip_count: user.trip_count + 1 }).eq("id", user.id);
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "여행 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ detail }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get("X-Session-Id");
    const user = await getUser(sessionId);
    if (!user) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

    const db = requireSupabase();
    const { data } = await db.from("trips").select().eq("owner_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json(data ?? []);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "여행 목록 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
