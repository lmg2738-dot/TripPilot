import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/api-helpers";
import { handleApiError, logApiWarn } from "@/lib/api-error";
import { requireSupabase } from "@/lib/supabase";
import { chatReply } from "@/lib/services/trip-ai";

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.headers.get("X-Session-Id");
    const user = await getUser(sessionId);
    if (!user) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.message) {
      logApiWarn("요청 본문 JSON 파싱 실패", { route: "POST /api/chat", operation: "parse_body", sessionId });
      return NextResponse.json({ detail: "요청 본문 JSON 형식이 올바르지 않습니다." }, { status: 400 });
    }
    let tripContext: Record<string, unknown> | undefined;

    if (body.trip_id) {
      const db = requireSupabase();
      const { data: trip } = await db.from("trips").select("itinerary").eq("id", body.trip_id).eq("owner_id", user.id).single();
      if (trip) tripContext = trip.itinerary as Record<string, unknown>;
    }

    const result = await chatReply(body.message, tripContext);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "챗봇 응답 생성 중 오류가 발생했습니다.", {
      route: "POST /api/chat",
      operation: "chat_reply",
      sessionId: req.headers.get("X-Session-Id"),
    });
  }
}
