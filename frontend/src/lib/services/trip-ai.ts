import { env } from "../env";
import { chatCompletion, parseJsonContent } from "../openrouter";
import { logger } from "../logger";

export interface TripPreferences {
  companions: string;
  vehicle: string;
  weather_preference: string;
  photo_spots: boolean;
  with_kids: boolean;
  budget: number;
  interests: string[];
  extra_notes: string;
}

const MOCK = {
  title: "부산 2박3일 가족 여행",
  days: [
    {
      day: 1,
      date: "2026-07-01",
      schedule: [
        { time: "09:00", place: "해운대해수욕장", activity: "해변 산책", type: "attraction" },
        { time: "11:00", place: "블루라인파크", activity: "스카이캡슐", type: "attraction" },
        { time: "13:00", place: "기장 할매국밥", activity: "점심", type: "meal" },
        { time: "15:00", place: "국립해양박물관", activity: "실내 체험", type: "attraction" },
      ],
      tips: "오후 비 예보로 야외는 오전 배치.",
    },
  ],
  recommendations: [{ place: "송도케이블카", reason: "아이와 좋음", recommended: true }],
  hidden_gems: [{ place: "이기대", reason: "현지인 추천" }],
  transportation: "SUV 자가용",
  indoor_alternatives: [{ original: "해운대", alternative: "국립해양박물관", reason: "비 대비" }],
  ai_reasoning: "날씨와 아이 동반을 반영했습니다.",
  travel_tips: ["선크림 필수"],
};

export async function generateItinerary(
  destination: string,
  startDate: string,
  endDate: string,
  preferences: TripPreferences,
  weather: unknown[],
  attractions: unknown[],
  trafficInfo: string,
  ktxInfo: string,
): Promise<Record<string, unknown>> {
  const apiKey = env.openrouterApiKey();
  if (!apiKey) {
    logger.warn("OpenRouter API 키 없음, mock 일정 사용", { operation: "generateItinerary", destination });
    return { ...MOCK, title: `${destination} 여행` };
  }

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a Korea travel planner. Output JSON only in Korean with keys: title, days, recommendations, hidden_gems, transportation, indoor_alternatives, ai_reasoning, travel_tips.`,
      },
      {
        role: "user",
        content: `목적지:${destination} 기간:${startDate}~${endDate} 동행:${preferences.companions} 차량:${preferences.vehicle} 아이:${preferences.with_kids} 예산:${preferences.budget} 날씨:${JSON.stringify(weather)} 관광지:${JSON.stringify(attractions)} 교통:${trafficInfo} KTX:${ktxInfo}`,
      },
    ],
    { jsonMode: true, apiKey, siteUrl: env.openrouterSiteUrl(), appName: env.openrouterAppName() },
  );
  return parseJsonContent(content);
}

export function calculateBudget(preferences: TripPreferences, itinerary: Record<string, unknown>, nights: number) {
  const days = (itinerary.days as unknown[]) ?? [];
  const scheduleCount = days.reduce((n: number, d) => n + ((d as { schedule?: unknown[] }).schedule?.length ?? 0), 0);
  const accommodation = 120000 * nights;
  const fuel = preferences.vehicle ? 30000 : 0;
  const toll = preferences.vehicle ? 20000 : 0;
  const entrance = Math.min(scheduleCount * 8000, 40000);
  const food = 100000 * Math.max(nights, 1);
  return { accommodation, fuel, toll, entrance_fees: entrance, food, total: accommodation + fuel + toll + entrance + food, currency: "KRW" };
}

export async function chatReply(message: string, tripContext?: Record<string, unknown>) {
  const apiKey = env.openrouterApiKey();
  if (!apiKey) {
    logger.warn("OpenRouter API 키 없음, mock 챗봇 응답 사용", { operation: "chatReply" });
    return {
      reply: "아이가 힘들어하신다면 **국립해양박물관**이나 **센텀시티 아쿠아리움**을 추천드립니다.",
      suggestions: ["국립해양박물관", "센텀시티 아쿠아리움"],
    };
  }
  const ctx = tripContext ? `\n일정:${JSON.stringify(tripContext)}` : "";
  const reply = await chatCompletion(
    [{ role: "system", content: "TripPilot AI 여행 비서. 한국어로 조언." }, { role: "user", content: message + ctx }],
    { apiKey, siteUrl: env.openrouterSiteUrl(), appName: env.openrouterAppName() },
  );
  const suggestions = reply.split("\n").filter((l) => /^[-•]/.test(l.trim())).map((l) => l.replace(/^[-•]\s*/, "").trim()).slice(0, 5);
  return { reply, suggestions };
}
