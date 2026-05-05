"""Supabase JWT authentication for FastAPI.

Verifies Supabase-issued JWTs (HS256, signed with the project's JWT secret)
and exposes dependencies that resolve a request to a local `User` row,
auto-creating one on first login.

Environment variables (set in `backend/.env`):
    SUPABASE_JWT_SECRET   — the project JWT secret (Supabase dashboard →
                            Project Settings → API → "JWT Secret")
    SUPABASE_PROJECT_URL  — optional, for documentation only
    SUPABASE_AUTH_DISABLED — set to "1" to bypass auth entirely (dev only)
"""
from __future__ import annotations
import os
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


VALID_ROLES = {"customer", "agent", "manager", "admin"}


def _jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: SUPABASE_JWT_SECRET not set",
        )
    return secret


def _auth_disabled() -> bool:
    return os.getenv("SUPABASE_AUTH_DISABLED", "").strip() in ("1", "true", "yes")


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            _jwt_secret(),
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token audience")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")


def _initials_from_name(name: str) -> str:
    parts = [p for p in (name or "").split() if p]
    if not parts:
        return "U"
    return "".join(p[0] for p in parts[:2]).upper()


def _upsert_user_from_claims(db: Session, claims: dict) -> User:
    email = (claims.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing email")

    meta = claims.get("user_metadata") or {}
    app_meta = claims.get("app_metadata") or {}

    # Role precedence: app_metadata.role (admin-set) > user_metadata.role > customer
    role = (app_meta.get("role") or meta.get("role") or "customer").lower().strip()
    if role not in VALID_ROLES:
        role = "customer"

    name = (meta.get("name") or meta.get("full_name") or email.split("@")[0]).strip()
    initials = (meta.get("initials") or _initials_from_name(name))[:4]
    title = (meta.get("title") or "").strip()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name, role=role, initials=initials, title=title)
        db.add(user)
        db.flush()
    else:
        # Keep local row in sync with the IdP — admin role changes flow through.
        changed = False
        if user.role != role:
            user.role = role
            changed = True
        if user.name != name and name:
            user.name = name
            changed = True
        if user.initials != initials and initials:
            user.initials = initials
            changed = True
        if changed:
            db.flush()
    return user


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve `Authorization: Bearer <jwt>` to a local User. 401 on failure."""
    if _auth_disabled():
        # Dev escape hatch — return (or create) a synthetic admin.
        u = db.query(User).filter(User.email == "dev@resolveai.app").first()
        if not u:
            u = User(
                email="dev@resolveai.app",
                name="Dev User",
                role="admin",
                initials="DU",
            )
            db.add(u)
            db.commit()
        return u

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Empty bearer token")

    claims = _decode_token(token)
    user = _upsert_user_from_claims(db, claims)
    db.commit()
    return user


def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user, but returns None instead of 401 when no token."""
    if not authorization:
        return None
    try:
        return get_current_user(authorization=authorization, db=db)
    except HTTPException:
        return None


def require_role(*roles: str):
    """Dependency factory: 403 if the current user is not in `roles`."""
    allowed = {r.lower() for r in roles}

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires role: {', '.join(sorted(allowed))}",
            )
        return user

    return _dep


# Convenience aliases
require_customer = require_role("customer")
require_staff = require_role("agent", "manager", "admin")
require_manager = require_role("manager", "admin")
require_admin = require_role("admin")
