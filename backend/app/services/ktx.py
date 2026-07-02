"""KTX/Korail 시간표 연동 서비스."""

import httpx

from app.config import settings
from app.schemas import KtxScheduleResponse

MOCK_SCHEDULES = [
    KtxScheduleResponse(
        train_no="KTX-101", departure="서울", arrival="부산",
        departure_time="06:00", arrival_time="08:45", duration_min=165,
    ),
    KtxScheduleResponse(
        train_no="KTX-105", departure="서울", arrival="부산",
        departure_time="08:30", arrival_time="11:15", duration_min=165,
    ),
    KtxScheduleResponse(
        train_no="KTX-201", departure="서울", arrival="부산",
        departure_time="12:00", arrival_time="14:45", duration_min=165,
    ),
    KtxScheduleResponse(
        train_no="KTX-301", departure="서울", arrival="부산",
        departure_time="17:00", arrival_time="19:45", duration_min=165,
    ),
]


class KtxService:
    async def search_schedule(
        self, departure: str, arrival: str, date: str
    ) -> list[KtxScheduleResponse]:
        if not settings.public_data_api_key:
            return [
                s for s in MOCK_SCHEDULES
                if departure in s.departure and arrival in s.arrival
            ] or MOCK_SCHEDULES

        params = {
            "serviceKey": settings.public_data_api_key,
            "depPlaceId": departure,
            "arrPlaceId": arrival,
            "depPlandTime": date.replace("-", ""),
            "numOfRows": "10",
            "_type": "json",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "http://apis.data.go.kr/1613000/TrainInfoService/getStrtpntAlocFndTrainInfo",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]

        return [
            KtxScheduleResponse(
                train_no=str(item.get("traingradename", "")),
                departure=departure,
                arrival=arrival,
                departure_time=str(item.get("depplandtime", ""))[-4:],
                arrival_time=str(item.get("arrplandtime", ""))[-4:],
                duration_min=165,
            )
            for item in items
        ]


ktx_service = KtxService()
