import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanType(str, enum.Enum):
    FREE = "free"
    PREMIUM = "premium"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), default="여행자")
    plan_type: Mapped[PlanType] = mapped_column(Enum(PlanType), default=PlanType.FREE)
    trip_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    trips: Mapped[list["Trip"]] = relationship(back_populates="owner")
    favorites: Mapped[list["Favorite"]] = relationship(back_populates="user")


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    destination: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[str] = mapped_column(String(10))
    end_date: Mapped[str] = mapped_column(String(10))
    preferences: Mapped[str] = mapped_column(Text, default="{}")
    itinerary: Mapped[str] = mapped_column(Text, default="{}")
    budget: Mapped[str] = mapped_column(Text, default="{}")
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="trips")


class Favorite(Base):
    __tablename__ = "favorites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    content_id: Mapped[str] = mapped_column(String(100))
    content_type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    data: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="favorites")
