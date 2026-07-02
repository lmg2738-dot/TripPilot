import secrets
import uuid

from fastapi import Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


def generate_session_id() -> str:
    return secrets.token_urlsafe(32)


def generate_share_token() -> str:
    return secrets.token_urlsafe(32)


async def get_or_create_user_by_session(db: AsyncSession, session_id: str) -> User:
    result = await db.execute(select(User).where(User.session_id == session_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = User(
        id=str(uuid.uuid4()),
        session_id=session_id,
        name="여행자",
    )
    db.add(user)
    await db.flush()
    return user


async def get_or_create_user(
    db: AsyncSession,
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> User:
    if not x_session_id or len(x_session_id) < 16:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Session-Id 헤더가 필요합니다.",
        )
    return await get_or_create_user_by_session(db, x_session_id)
