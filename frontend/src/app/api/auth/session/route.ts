import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { handleApiError, logDbError } from "@/lib/api-error";
import { requireSupabase } from "@/lib/supabase";

export async function POST() {
  try {
    const db = requireSupabase();
    const sessionId = randomBytes(24).toString("base64url");

    const { data: user, error } = await db
      .from("users")
      .insert({ session_id: sessionId, name: "여행자" })
      .select()
      .single();

    if (error) {
      logDbError("세션 생성 DB 실패", error, { route: "POST /api/auth/session", operation: "insert_user" });
      return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ session_id: sessionId, user });
  } catch (error) {
    return handleApiError(error, "세션 생성 중 오류가 발생했습니다.", {
      route: "POST /api/auth/session",
      operation: "create_session",
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get("X-Session-Id");
    if (!sessionId) return NextResponse.json({ detail: "X-Session-Id 필요" }, { status: 401 });

    const db = requireSupabase();
    const { data: user } = await db.from("users").select().eq("session_id", sessionId).single();
    if (!user) return NextResponse.json({ detail: "세션 없음" }, { status: 401 });
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, "세션 조회 중 오류가 발생했습니다.", {
      route: "GET /api/auth/session",
      operation: "get_session",
      sessionId: req.headers.get("X-Session-Id"),
    });
  }
}
