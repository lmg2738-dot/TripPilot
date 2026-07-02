"""한국관광공사 TourAPI 연동 서비스."""

import httpx

from app.config import settings
from app.schemas import AttractionResponse

TOUR_BASE = "http://apis.data.go.kr/B551011/KorService2"
AREA_CODES = {
    "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5",
    "부산": "6", "울산": "7", "세종": "8", "경기": "31", "강원": "32",
    "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37",
    "전남": "38", "제주": "39",
}

MOCK_ATTRACTIONS: dict[str, list[dict]] = {
    "부산": [
        {"contentid": "126128", "title": "해운대해수욕장", "addr1": "부산 해운대구 우동", "cat1": "A01", "firstimage": "", "overview": "대한민국 대표 해수욕장", "mapx": "129.1586", "mapy": "35.1587"},
        {"contentid": "2784167", "title": "블루라인파크", "addr1": "부산 기장군 기장읍", "cat1": "A01", "firstimage": "", "overview": "해안열차와 스카이캡슐", "mapx": "129.2222", "mapy": "35.2444"},
        {"contentid": "126535", "title": "감천문화마을", "addr1": "부산 사하구 감천동", "cat1": "A02", "firstimage": "", "overview": "알록달록 예술마을", "mapx": "129.0106", "mapy": "35.0975"},
        {"contentid": "128622", "title": "송도해상케이블카", "addr1": "부산 서구 암남동", "cat1": "A01", "firstimage": "", "overview": "바다 위를 가로지르는 케이블카", "mapx": "129.0178", "mapy": "35.0761"},
        {"contentid": "126202", "title": "자갈치시장", "addr1": "부산 중구 자갈치해안로", "cat1": "A04", "firstimage": "", "overview": "부산 대표 수산시장", "mapx": "129.0306", "mapy": "35.0967"},
        {"contentid": "2784175", "title": "국립해양박물관", "addr1": "부산 영도구", "cat1": "A02", "firstimage": "", "overview": "실내 해양 체험 박물관", "mapx": "129.0667", "mapy": "35.0583"},
    ],
    "제주": [
        {"contentid": "127011", "title": "성산일출봉", "addr1": "제주 서귀포시 성산읍", "cat1": "A01", "firstimage": "", "overview": "유네스코 세계자연유산", "mapx": "126.9411", "mapy": "33.4581"},
        {"contentid": "127570", "title": "협재해수욕장", "addr1": "제주 제주시 한림읍", "cat1": "A01", "firstimage": "", "overview": "에메랄드빛 바다", "mapx": "126.2394", "mapy": "33.3936"},
    ],
}


def _parse_attraction(item: dict) -> AttractionResponse:
    return AttractionResponse(
        content_id=str(item.get("contentid", "")),
        title=item.get("title", ""),
        address=item.get("addr1", ""),
        category=item.get("cat1", ""),
        image=item.get("firstimage", ""),
        overview=item.get("overview", "")[:300],
        map_x=float(item.get("mapx", 0) or 0),
        map_y=float(item.get("mapy", 0) or 0),
    )


class TourAPIService:
    async def search_attractions(
        self, destination: str, keyword: str = "", limit: int = 20
    ) -> list[AttractionResponse]:
        area_code = None
        for name, code in AREA_CODES.items():
            if name in destination:
                area_code = code
                break

        if not settings.public_data_api_key:
            mock = MOCK_ATTRACTIONS.get(destination, MOCK_ATTRACTIONS.get("부산", []))
            return [_parse_attraction(a) for a in mock[:limit]]

        params = {
            "serviceKey": settings.public_data_api_key,
            "MobileOS": "ETC",
            "MobileApp": "TripPilot",
            "numOfRows": str(limit),
            "pageNo": "1",
            "_type": "json",
            "listYN": "Y",
            "arrange": "O",
        }
        if area_code:
            params["areaCode"] = area_code
        if keyword:
            params["keyword"] = keyword

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{TOUR_BASE}/areaBasedList2", params=params)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]
            return [_parse_attraction(i) for i in items]

    async def search_restaurants(self, destination: str, limit: int = 10) -> list[AttractionResponse]:
        return await self.search_attractions(destination, keyword="맛집", limit=limit)

    async def search_festivals(self, destination: str, limit: int = 10) -> list[AttractionResponse]:
        if not settings.public_data_api_key:
            return []
        area_code = AREA_CODES.get(destination, "6")
        params = {
            "serviceKey": settings.public_data_api_key,
            "MobileOS": "ETC",
            "MobileApp": "TripPilot",
            "numOfRows": str(limit),
            "pageNo": "1",
            "_type": "json",
            "listYN": "Y",
            "areaCode": area_code,
            "eventStartDate": "20260101",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{TOUR_BASE}/searchFestival2", params=params)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]
            return [_parse_attraction(i) for i in items]

tour_api = TourAPIService()
