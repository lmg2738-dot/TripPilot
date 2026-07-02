import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/api-helpers";
import { requireSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionId = req.headers.get("X-Session-Id");
    const user = await getUser(sessionId);
    if (!user) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

    const db = requireSupabase();
    const { data: trip } = await db.from("trips").select().eq("id", id).eq("owner_id", user.id).single();
    if (!trip) return NextResponse.json({ detail: "여행 없음" }, { status: 404 });
    return NextResponse.json(trip);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "여행 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
