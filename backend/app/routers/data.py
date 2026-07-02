from fastapi import APIRouter

from app.schemas import AttractionResponse, KtxScheduleResponse, TrafficResponse, WeatherResponse
from app.services.ktx import ktx_service
from app.services.tour_api import tour_api
from app.services.traffic import traffic_service
from app.services.weather import weather_service

router = APIRouter(prefix="/data", tags=["데이터"])


@router.get("/attractions/{destination}", response_model=list[AttractionResponse])
async def get_attractions(destination: str, keyword: str = "", limit: int = 20):
    return await tour_api.search_attractions(destination, keyword=keyword, limit=limit)


@router.get("/weather/{destination}", response_model=list[WeatherResponse])
async def get_weather(destination: str, days: int = 3):
    return await weather_service.get_forecast(destination, days=days)


@router.get("/traffic", response_model=TrafficResponse)
async def get_traffic(origin: str = "서울", destination: str = "부산"):
    return await traffic_service.get_traffic(origin, destination)


@router.get("/ktx", response_model=list[KtxScheduleResponse])
async def get_ktx(departure: str = "서울", arrival: str = "부산", date: str = "2026-07-01"):
    return await ktx_service.search_schedule(departure, arrival, date)
