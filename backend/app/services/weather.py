"""기상청 공공데이터 날씨 연동 서비스."""

from datetime import datetime, timedelta

import httpx

from app.config import settings
from app.schemas import WeatherResponse

KMA_BASE = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"

COORDS = {
    "부산": (98, 76),
    "서울": (60, 127),
    "제주": (52, 38),
    "대구": (89, 90),
    "인천": (55, 124),
    "광주": (58, 74),
    "대전": (67, 100),
    "울산": (102, 84),
    "경주": (91, 92),
}


def _get_base_datetime() -> tuple[str, str]:
    now = datetime.now()
    if now.hour < 2:
        base = now - timedelta(days=1)
        base_time = "2300"
    elif now.hour < 5:
        base_time = "0200"
        base = now
    elif now.hour < 8:
        base_time = "0500"
        base = now
    elif now.hour < 11:
        base_time = "0800"
        base = now
    elif now.hour < 14:
        base_time = "1100"
        base = now
    elif now.hour < 17:
        base_time = "1400"
        base = now
    elif now.hour < 20:
        base_time = "1700"
        base = now
    elif now.hour < 23:
        base_time = "2000"
        base = now
    else:
        base_time = "2300"
        base = now
    return base.strftime("%Y%m%d"), base_time


def _mock_weather(destination: str, days: int) -> list[WeatherResponse]:
    results = []
    base_date = datetime.now()
    for i in range(days):
        d = base_date + timedelta(days=i)
        rain = 30 + (i * 15) % 60
        results.append(
            WeatherResponse(
                date=d.strftime("%Y-%m-%d"),
                location=destination,
                sky="맑음" if rain < 40 else "흐림" if rain < 70 else "비",
                temp_min=18.0 + i,
                temp_max=26.0 + i,
                rain_probability=rain,
                wind_speed=2.5,
                uv_index=6,
                feels_like=24.0 + i,
            )
        )
    return results


class WeatherService:
    async def get_forecast(self, destination: str, days: int = 3) -> list[WeatherResponse]:
        nx, ny = COORDS.get(destination, (60, 127))

        if not settings.public_data_api_key:
            return _mock_weather(destination, days)

        base_date, base_time = _get_base_datetime()
        params = {
            "serviceKey": settings.public_data_api_key,
            "pageNo": "1",
            "numOfRows": "1000",
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": str(nx),
            "ny": str(ny),
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{KMA_BASE}/getVilageFcst", params=params)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])

        daily: dict[str, dict] = {}
        sky_map = {"1": "맑음", "3": "구름많음", "4": "흐림"}
        for item in items:
            fcst_date = item.get("fcstDate", "")
            category = item.get("category", "")
            value = item.get("fcstValue", "")
            if fcst_date not in daily:
                daily[fcst_date] = {}
            daily[fcst_date][category] = value

        results = []
        for date_str, vals in sorted(daily.items())[:days]:
            formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            results.append(
                WeatherResponse(
                    date=formatted,
                    location=destination,
                    sky=sky_map.get(vals.get("SKY", "1"), "맑음"),
                    temp_min=float(vals.get("TMN", vals.get("TMP", 20))),
                    temp_max=float(vals.get("TMX", vals.get("TMP", 28))),
                    rain_probability=int(float(vals.get("POP", 0))),
                    wind_speed=float(vals.get("WSD", 2.0)),
                    uv_index=5,
                    feels_like=float(vals.get("TMP", 24)),
                )
            )
        return results or _mock_weather(destination, days)


weather_service = WeatherService()
