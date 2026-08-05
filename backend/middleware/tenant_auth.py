"""Tenant portal JWT authentication — entirely separate identity system from
the staff User/JWT auth in middleware/auth.py. A tenant token carries
type='tenant' so it can never be mistaken for (or reused as) a staff
token even though both are signed with the same JWT_SECRET, and
get_current_tenant only ever looks tenants up by id, never User rows.
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database.session import get_db
from models.tenant import Tenant
from config import settings

# auto_error=False so a missing header raises our own 401 with a clearer
# message, consistent with get_current_tenant's other failure paths below.
tenant_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/tenant-portal/login", auto_error=False)

# Tenants log in far less often than staff and shouldn't have to re-auth
# constantly to check their balance or pay rent — longer-lived session.
TENANT_TOKEN_EXPIRY = timedelta(days=30)


def create_tenant_access_token(tenant_id: str) -> str:
    expire = datetime.utcnow() + TENANT_TOKEN_EXPIRY
    to_encode = {"sub": tenant_id, "type": "tenant", "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_tenant(
    token: str = Depends(tenant_oauth2_scheme),
    db: Session = Depends(get_db),
) -> Tenant:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session — please log in again",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "tenant":
            raise credentials_exception
        tenant_id = payload.get("sub")
        if not tenant_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    tenant = db.query(Tenant).filter(Tenant.id == UUID(tenant_id)).first()
    if tenant is None or not tenant.is_active or not tenant.hashed_password:
        raise credentials_exception
    return tenant
