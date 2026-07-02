"""OpenRouter 무료 모델 기반 AI 여행 일정 생성."""

import json
from typing import Any

from app.config import settings
from app.schemas import AttractionResponse, TripPreferences, WeatherResponse
from app.services.openrouter import chat_completion, parse_json_content

SYSTEM_PROMPT = """You are a professional travel planner for Korea.

Create an optimized itinerary based on:
- Destination, Travel dates, Weather forecast, Tourist attractions
- Traffic conditions, User preferences, Budget

Output a JSON object with this structure:
{
  "title": "여행 제목",
  "days": [{"day": 1, "date": "YYYY-MM-DD", "schedule": [{"time": "09:00", "place": "장소", "activity": "활동", "type": "attraction|meal|transport"}], "tips": "팁"}],
  "recommendations": [{"place": "장소", "reason": "이유", "recommended": true}],
  "hidden_gems": [{"place": "명소", "reason": "이유"}],
  "transportation": "교통 계획",
  "indoor_alternatives": [{"original": "원래", "alternative": "대체", "reason": "이유"}],
  "ai_reasoning": "일정 배치 이유",
  "travel_tips": ["팁1"]
}

Rules: Respond ONLY with valid JSON. Content in Korean.
Place outdoor activities in morning if rain forecast in afternoon.
Avoid stairs if with_kids is true.
"""

MOCK_ITINERARY = {
    "title": "부산 2박3일 가족 여행",
    "days": [
        {
            "day": 1,
            "date": "2026-07-01",
            "schedule": [
                {"time": "09:00", "place": "해운대해수욕장", "activity": "해변 산책 & 사진", "type": "attraction"},
                {"time": "11:00", "place": "블루라인파크", "activity": "스카이캡슐", "type": "attraction"},
                {"time": "13:00", "place": "기장 할매국밥", "activity": "점심", "type": "meal"},
                {"time": "15:00", "place": "국립해양박물관", "activity": "실내 체험", "type": "attraction"},
                {"time": "19:00", "place": "광안리 야경", "activity": "야경", "type": "attraction"},
            ],
            "tips": "오후 비 예보로 야외는 오전 배치.",
        },
        {
            "day": 2,
            "date": "2026-07-02",
            "schedule": [
                {"time": "09:30", "place": "송도해상케이블카", "activity": "케이블카", "type": "attraction"},
                {"time": "12:00", "place": "자갈치시장", "activity": "회 점심", "type": "meal"},
                {"time": "14:00", "place": "감천문화마을", "activity": "마을 산책", "type": "attraction"},
            ],
            "tips": "감천마을은 계단이 많습니다.",
        },
    ],
    "recommendations": [
        {"place": "송도해상케이블카", "reason": "아이와 함께 좋음", "recommended": True},
        {"place": "감천문화마을", "reason": "계단 많음", "recommended": False},
    ],
    "hidden_gems": [{"place": "이기대 해안산책로", "reason": "현지인 추천"}],
    "transportation": "SUV 자가용",
    "indoor_alternatives": [{"original": "해운대", "alternative": "국립해양박물관", "reason": "비 대비"}],
    "ai_reasoning": "날씨·아이 동반을 반영해 일정을 배치했습니다.",
    "travel_tips": ["선크림 필수"],
}


class AIService:
    def _build_user_prompt(
        self,
        destination: str,
        start_date: str,
        end_date: str,
        preferences: TripPreferences,
        attractions: list[AttractionResponse],
        weather: list[WeatherResponse],
        traffic_info: str,
        ktx_info: str,
    ) -> str:
        return f"""여행 일정을 생성해주세요.

목적지: {destination}
기간: {start_date} ~ {end_date}
동행: {preferences.companions}
차량: {preferences.vehicle}
날씨 선호: {preferences.weather_preference}
사진 명소: {preferences.photo_spots}
아이 동반: {preferences.with_kids}
예산: {preferences.budget:,}원
관심사: {', '.join(preferences.interests)}
추가: {preferences.extra_notes}

날씨: {json.dumps([w.model_dump() for w in weather], ensure_ascii=False)}
관광지: {json.dumps([a.model_dump() for a in attractions], ensure_ascii=False)}
교통: {traffic_info}
KTX: {ktx_info}
"""

    async def generate_itinerary(
        self,
        destination: str,
        start_date: str,
        end_date: str,
        preferences: TripPreferences,
        attractions: list[AttractionResponse],
        weather: list[WeatherResponse],
        traffic_info: str = "",
        ktx_info: str = "",
    ) -> dict[str, Any]:
        if not settings.openrouter_api_key:
            result = dict(MOCK_ITINERARY)
            result["title"] = f"{destination} 여행"
            if weather:
                for i, day in enumerate(result.get("days", [])):
                    if i < len(weather):
                        day["date"] = weather[i].date
            return result

        prompt = self._build_user_prompt(
            destination, start_date, end_date, preferences,
            attractions, weather, traffic_info, ktx_info,
        )
        content = await chat_completion(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            json_mode=True,
        )
        return parse_json_content(content)

    async def chat(
        self,
        message: str,
        trip_context: dict[str, Any] | None = None,
    ) -> tuple[str, list[str]]:
        if not settings.openrouter_api_key:
            return (
                "아이가 힘들어하신다면 **국립해양박물관**이나 **센텀시티 아쿠아리움**을 추천드립니다.",
                ["국립해양박물관", "센텀시티 아쿠아리움"],
            )

        context = ""
        if trip_context:
            context = f"\n현재 일정:\n{json.dumps(trip_context, ensure_ascii=False)}"

        reply = await chat_completion(
            [
                {
                    "role": "system",
                    "content": "TripPilot AI 여행 비서. 한국어로 실시간 여행 조언 제공.",
                },
                {"role": "user", "content": f"{message}{context}"},
            ],
        )
        suggestions = [
            line.strip().lstrip("-• ").strip()
            for line in reply.split("\n")
            if line.strip().startswith(("-", "•"))
        ]
        return reply, suggestions[:5]

    def calculate_budget(
        self,
        preferences: TripPreferences,
        itinerary: dict[str, Any],
        nights: int,
    ) -> dict[str, Any]:
        base_accommodation = 120000 * nights
        base_fuel = 30000 if preferences.vehicle else 0
        base_toll = 20000 if preferences.vehicle else 0
        attractions_count = sum(len(d.get("schedule", [])) for d in itinerary.get("days", []))
        base_entrance = min(attractions_count * 8000, 40000)
        base_food = 100000 * max(nights, 1)
        total = base_accommodation + base_fuel + base_toll + base_entrance + base_food
        if preferences.budget > 0 and total > preferences.budget:
            ratio = preferences.budget / total
            base_accommodation = int(base_accommodation * ratio)
            base_food = int(base_food * ratio)
        return {
            "accommodation": base_accommodation,
            "fuel": base_fuel,
            "toll": base_toll,
            "entrance_fees": base_entrance,
            "food": base_food,
            "total": base_accommodation + base_fuel + base_toll + base_entrance + base_food,
            "currency": "KRW",
        }


ai_service = AIService()
