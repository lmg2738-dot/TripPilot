import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_or_create_user
from app.database import get_db
from app.models import Favorite, Trip, User
from app.schemas import ChatMessage, ChatResponse, FavoriteCreate, FavoriteResponse
from app.services.ai import ai_service

router = APIRouter(tags=["기타"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatMessage,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    trip_context = None
    if body.trip_id:
        result = await db.execute(
            select(Trip).where(Trip.id == body.trip_id, Trip.owner_id == user.id)
        )
        trip = result.scalar_one_or_none()
        if trip:
            trip_context = json.loads(trip.itinerary)

    reply, suggestions = await ai_service.chat(body.message, trip_context)
    return ChatResponse(reply=reply, suggestions=suggestions)


@router.get("/favorites", response_model=list[FavoriteResponse])
async def list_favorites(
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())
    )
    favorites = result.scalars().all()
    return [
        FavoriteResponse(
            id=f.id,
            content_id=f.content_id,
            content_type=f.content_type,
            title=f.title,
            data=json.loads(f.data),
            created_at=f.created_at,
        )
        for f in favorites
    ]


@router.post("/favorites", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    body: FavoriteCreate,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    favorite = Favorite(
        user_id=user.id,
        content_id=body.content_id,
        content_type=body.content_type,
        title=body.title,
        data=json.dumps(body.data, ensure_ascii=False),
    )
    db.add(favorite)
    await db.flush()

    return FavoriteResponse(
        id=favorite.id,
        content_id=favorite.content_id,
        content_type=favorite.content_type,
        title=favorite.title,
        data=body.data,
        created_at=favorite.created_at,
    )


@router.delete("/favorites/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    favorite_id: str,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite).where(Favorite.id == favorite_id, Favorite.user_id == user.id)
    )
    favorite = result.scalar_one_or_none()
    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="즐겨찾기를 찾을 수 없습니다")
    await db.delete(favorite)
