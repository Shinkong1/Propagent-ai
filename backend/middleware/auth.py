"""JWT Authentication middleware"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from config import settings

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=settings.JWT_EXPIRY_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


# Paths a locked-out org must still be able to reach: to see their own status, to
# subscribe, to sign out, or to reach support. Everything else requires an active
# trial or paid subscription.
TRIAL_EXEMPT_PREFIXES = ("/auth", "/billing", "/contact", "/mfa", "/oauth")

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}


def _org_has_access(org) -> bool:
    if org.subscription_status in ACTIVE_SUBSCRIPTION_STATUSES:
        return True
    if org.trial_ends_at is not None and datetime.utcnow() < org.trial_ends_at:
        return True
    # Orgs created before the trial system existed have no trial_ends_at at all —
    # treat as still-active rather than retroactively locking out real accounts.
    return org.trial_ends_at is None


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception

    if not user.is_master and not any(request.url.path.startswith(p) for p in TRIAL_EXEMPT_PREFIXES):
        if user.organization and not _org_has_access(user.organization):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Your 14-day free trial has ended. Subscribe to a plan to keep using PropAgent.",
            )

    return user
