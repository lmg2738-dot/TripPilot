from fastapi import APIRouter, Depends

from app.auth import generate_session_id, get_or_create_user, get_or_create_user_by_session
from app.database import get_db
from app.models import User
from app.schemas import SessionResponse, UserResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["세션"])


@router.post("/session", response_model=SessionResponse)
async def create_session(db: AsyncSession = Depends(get_db)):
    session_id = generate_session_id()
    user = await get_or_create_user_by_session(db, session_id)
    return SessionResponse(session_id=session_id, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_or_create_user)):
    return UserResponse.model_validate(user)
