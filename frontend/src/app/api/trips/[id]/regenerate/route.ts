import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/api-helpers";
import { handleApiError } from "@/lib/api-error";
import { requireSupabase } from "@/lib/supabase";
import { searchAttractions, getWeather, getTraffic } from "@/lib/services/public-data";
import { generateItinerary, calculateBudget, TripPreferences } from "@/lib/services/trip-ai";

function nights(start: string, end: string) {
  return Math.max(Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000), 1);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionId = req.headers.get("X-Session-Id");
    const user = await getUser(sessionId);
    if (!user) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

    const db = requireSupabase();
    const { data: trip } = await db.from("trips").select().eq("id", id).eq("owner_id", user.id).single();
    if (!trip) return NextResponse.json({ detail: "여행 없음" }, { status: 404 });

    const prefs = trip.preferences as TripPreferences;
    const dayCount = nights(trip.start_date, trip.end_date) + 1;
    const [attractions, weather, traffic] = await Promise.all([
      searchAttractions(trip.destination),
      getWeather(trip.destination, dayCount),
      getTraffic("서울", trip.destination),
    ]);

    const itinerary = await generateItinerary(
      trip.destination, trip.start_date, trip.end_date, prefs, weather, attractions,
      `${traffic.congestion_level}, ${traffic.estimated_time_min}분`, "",
    );
    const budget = calculateBudget(prefs, itinerary, nights(trip.start_date, trip.end_date));

    const { data: updated } = await db.from("trips").update({
      itinerary, budget, title: (itinerary.title as string) ?? trip.title, updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "여행 재생성 중 오류가 발생했습니다.", {
      route: "POST /api/trips/[id]/regenerate",
      operation: "regenerate_trip",
      sessionId: req.headers.get("X-Session-Id"),
    });
  }
}
