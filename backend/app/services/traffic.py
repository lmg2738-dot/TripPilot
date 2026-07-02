"""도로공사 교통정보 연동 서비스."""

from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings
from app.schemas import TrafficResponse

EX_TRAFFIC_VOLUME_URL = "http://data.ex.co.kr/openapi/trafficapi/nationalTrafficVolumn"


def _kst_today() -> str:
    kst = datetime.now(timezone(timedelta(hours=9)))
    return kst.strftime("%Y%m%d")


def _build_ex_url(api_key: str, params: dict[str, str]) -> str:
    from urllib.parse import urlencode

    if "%" in api_key:
        query = urlencode(params)
        return f"{EX_TRAFFIC_VOLUME_URL}?key={api_key}&{query}"
    return f"{EX_TRAFFIC_VOLUME_URL}?{urlencode({'key': api_key, **params})}"


def _volume_to_congestion(total_volume: int) -> str:
    if total_volume >= 500_000:
        return "정체"
    if total_volume >= 300_000:
        return "서행"
    if total_volume >= 150_000:
        return "보통"
    return "원활"


def _estimate_minutes(origin: str, destination: str, congestion: str) -> int:
    base_map = {
        ("서울", "부산"): 100,
        ("부산", "서울"): 100,
        ("서울", "대구"): 80,
        ("서울", "광주"): 95,
        ("서울", "대전"): 70,
    }
    base = base_map.get((origin, destination), 90)
    if congestion == "정체":
        return base + 35
    if congestion == "서행":
        return base + 20
    if congestion == "보통":
        return base + 10
    return base


class TrafficService:
    async def get_traffic(self, origin: str, destination: str) -> TrafficResponse:
        fallback = TrafficResponse(
            route=f"{origin} → {destination}",
            congestion_level="보통",
            estimated_time_min=90,
            detour_available=True,
            message="[데모] 고속도로 교통량 보통. 우회도로 이용 가능.",
        )
        if not settings.ex_api_key:
            return fallback

        sum_date = _kst_today()
        params = {"type": "json", "sumDate": sum_date, "exDivCode": "00"}
        keys = [settings.ex_api_key]
        if "%" in settings.ex_api_key:
            from urllib.parse import unquote

            keys.append(unquote(settings.ex_api_key))

        async with httpx.AsyncClient(timeout=20.0) as client:
            for api_key in keys:
                try:
                    resp = await client.get(_build_ex_url(api_key, params))
                    if resp.status_code in (401, 403):
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    items = data.get("list") or []
                    if not items:
                        continue
                    total = sum(int(item.get("trafficVolumn", 0) or 0) for item in items)
                    congestion = _volume_to_congestion(total)
                    return TrafficResponse(
                        route=f"{origin} → {destination}",
                        congestion_level=congestion,
                        estimated_time_min=_estimate_minutes(origin, destination, congestion),
                        detour_available=congestion != "원활",
                        message=f"전국 교통량 {total:,}대 기준 ({sum_date})",
                    )
                except Exception:
                    continue

        return fallback


traffic_service = TrafficService()
