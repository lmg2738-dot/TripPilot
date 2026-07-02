from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SessionResponse(BaseModel):
    session_id: str
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    name: str
    plan_type: str
    trip_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TripPreferences(BaseModel):
    companions: str = ""
    vehicle: str = ""
    weather_preference: str = ""
    photo_spots: bool = False
    with_kids: bool = False
    budget: int = 0
    interests: list[str] = Field(default_factory=list)
    extra_notes: str = ""


class TripCreate(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    start_date: str
    end_date: str
    preferences: TripPreferences = Field(default_factory=TripPreferences)


class TripResponse(BaseModel):
    id: str
    title: str
    destination: str
    start_date: str
    end_date: str
    preferences: dict[str, Any]
    itinerary: dict[str, Any]
    budget: dict[str, Any]
    share_token: str | None
    is_shared: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripShareResponse(BaseModel):
    share_url: str
    share_token: str


class FavoriteCreate(BaseModel):
    content_id: str
    content_type: str
    title: str
    data: dict[str, Any] = Field(default_factory=dict)


class FavoriteResponse(BaseModel):
    id: str
    content_id: str
    content_type: str
    title: str
    data: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    trip_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = Field(default_factory=list)


class WeatherResponse(BaseModel):
    date: str
    location: str
    sky: str
    temp_min: float
    temp_max: float
    rain_probability: int
    wind_speed: float
    uv_index: int
    feels_like: float


class AttractionResponse(BaseModel):
    content_id: str
    title: str
    address: str
    category: str
    image: str
    overview: str
    map_x: float
    map_y: float


class TrafficResponse(BaseModel):
    route: str
    congestion_level: str
    estimated_time_min: int
    detour_available: bool
    message: str


class KtxScheduleResponse(BaseModel):
    train_no: str
    departure: str
    arrival: str
    departure_time: str
    arrival_time: str
    duration_min: int
