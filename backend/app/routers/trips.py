import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import generate_share_token, get_or_create_user
from app.config import settings
from app.database import get_db
from app.models import PlanType, Trip, User
from app.schemas import TripCreate, TripResponse, TripShareResponse
from app.services.ai import ai_service
from app.services.ktx import ktx_service
from app.services.pdf import pdf_service
from app.services.tour_api import tour_api
from app.services.traffic import traffic_service
from app.services.weather import weather_service

router = APIRouter(prefix="/trips", tags=["여행"])


def _trip_to_response(trip: Trip) -> TripResponse:
    return TripResponse(
        id=trip.id,
        title=trip.title,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        preferences=json.loads(trip.preferences),
        itinerary=json.loads(trip.itinerary),
        budget=json.loads(trip.budget),
        share_token=trip.share_token,
        is_shared=trip.is_shared,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
    )


def _calc_nights(start: str, end: str) -> int:
    s = datetime.strptime(start, "%Y-%m-%d")
    e = datetime.strptime(end, "%Y-%m-%d")
    return max((e - s).days, 1)


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    body: TripCreate,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    if user.plan_type == PlanType.FREE and user.trip_count >= settings.free_trip_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"무료 플랜은 {settings.free_trip_limit}회까지 여행을 생성할 수 있습니다. Premium으로 업그레이드하세요.",
        )

    nights = _calc_nights(body.start_date, body.end_date)
    days = nights + 1

    attractions = await tour_api.search_attractions(body.destination, limit=20)
    restaurants = await tour_api.search_restaurants(body.destination, limit=10)
    weather = await weather_service.get_forecast(body.destination, days=days)
    traffic = await traffic_service.get_traffic("서울", body.destination)
    ktx_schedules = await ktx_service.search_schedule("서울", body.destination, body.start_date)

    traffic_info = f"{traffic.route}: {traffic.congestion_level}, 약 {traffic.estimated_time_min}분"
    ktx_info = ", ".join(
        f"{s.train_no} {s.departure_time}-{s.arrival_time}" for s in ktx_schedules[:3]
    )

    itinerary = await ai_service.generate_itinerary(
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        preferences=body.preferences,
        attractions=attractions + restaurants,
        weather=weather,
        traffic_info=traffic_info,
        ktx_info=ktx_info,
    )

    budget = ai_service.calculate_budget(body.preferences, itinerary, nights)

    trip = Trip(
        owner_id=user.id,
        title=itinerary.get("title", f"{body.destination} 여행"),
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        preferences=json.dumps(body.preferences.model_dump(), ensure_ascii=False),
        itinerary=json.dumps(itinerary, ensure_ascii=False),
        budget=json.dumps(budget, ensure_ascii=False),
    )
    db.add(trip)
    user.trip_count += 1
    await db.flush()

    return _trip_to_response(trip)


@router.get("", response_model=list[TripResponse])
async def list_trips(
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trip).where(Trip.owner_id == user.id).order_by(Trip.created_at.desc())
    )
    trips = result.scalars().all()
    return [_trip_to_response(t) for t in trips]


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: str,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.owner_id == user.id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다")
    return _trip_to_response(trip)


@router.post("/{trip_id}/regenerate", response_model=TripResponse)
async def regenerate_trip(
    trip_id: str,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.owner_id == user.id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다")

    prefs = json.loads(trip.preferences)
    from app.schemas import TripPreferences
    preferences = TripPreferences(**prefs)

    nights = _calc_nights(trip.start_date, trip.end_date)
    days = nights + 1

    attractions = await tour_api.search_attractions(trip.destination, limit=20)
    weather = await weather_service.get_forecast(trip.destination, days=days)
    traffic = await traffic_service.get_traffic("서울", trip.destination)

    itinerary = await ai_service.generate_itinerary(
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        preferences=preferences,
        attractions=attractions,
        weather=weather,
        traffic_info=f"{traffic.congestion_level}, {traffic.estimated_time_min}분",
        ktx_info="",
    )

    budget = ai_service.calculate_budget(preferences, itinerary, nights)
    trip.itinerary = json.dumps(itinerary, ensure_ascii=False)
    trip.budget = json.dumps(budget, ensure_ascii=False)
    trip.title = itinerary.get("title", trip.title)
    await db.flush()

    return _trip_to_response(trip)


@router.post("/{trip_id}/share", response_model=TripShareResponse)
async def share_trip(
    trip_id: str,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.owner_id == user.id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다")

    if not trip.share_token:
        trip.share_token = generate_share_token()
    trip.is_shared = True
    await db.flush()

    return TripShareResponse(
        share_token=trip.share_token,
        share_url=f"/share/{trip.share_token}",
    )


@router.get("/share/{share_token}", response_model=TripResponse)
async def get_shared_trip(share_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Trip).where(Trip.share_token == share_token, Trip.is_shared == True)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공유된 여행을 찾을 수 없습니다")
    return _trip_to_response(trip)


@router.get("/{trip_id}/pdf")
async def download_pdf(
    trip_id: str,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.owner_id == user.id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다")

    itinerary = json.loads(trip.itinerary)
    budget = json.loads(trip.budget)
    share_url = f"/share/{trip.share_token}" if trip.share_token else ""

    pdf_bytes = pdf_service.generate(
        trip_title=trip.title,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        itinerary=itinerary,
        budget=budget,
        share_url=share_url,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="trippilot_{trip.id}.pdf"'},
    )
