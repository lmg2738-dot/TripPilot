"""도로공사 교통정보 연동 서비스."""

import httpx

from app.config import settings
from app.schemas import TrafficResponse

EX_BASE = "https://data.ex.co.kr/openapi/trafficapi"


class TrafficService:
    async def get_traffic(self, origin: str, destination: str) -> TrafficResponse:
        if not settings.ex_api_key:
            return TrafficResponse(
                route=f"{origin} → {destination}",
                congestion_level="보통",
                estimated_time_min=90,
                detour_available=True,
                message="[데모] 고속도로 교통량 보통. 우회도로 이용 가능.",
            )

        params = {
            "key": settings.ex_api_key,
            "type": "json",
            "numOfRows": "10",
            "pageNo": "1",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{EX_BASE}/liveTraffic", params=params)
            resp.raise_for_status()
            data = resp.json()

        items = data if isinstance(data, list) else data.get("list", [])
        if items:
            item = items[0]
            return TrafficResponse(
                route=f"{origin} → {destination}",
                congestion_level=item.get("congestion", "보통"),
                estimated_time_min=int(item.get("travelTime", 90)),
                detour_available=True,
                message=item.get("message", "교통정보 조회 완료"),
            )
        return TrafficResponse(
            route=f"{origin} → {destination}",
            congestion_level="원활",
            estimated_time_min=80,
            detour_available=False,
            message="교통정보 조회 완료",
        )


traffic_service = TrafficService()
