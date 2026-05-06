"""Supabase JWT authentication for FastAPI.

Verifies Supabase-issued JWTs and exposes dependencies that resolve a request
to a local `User` row, auto-creating one on first login.

Supabase issues JWTs in two formats:

1. **Legacy HS256** — symmetric, signed with the project's JWT Secret. Set
   `SUPABASE_JWT_SECRET` and we verify locally.
2. **Asymmetric ES256 / RS256** — newer projects (and any project that has
   rotated to "JWT Signing Keys"). The public keys are published at
   `<project-url>/auth/v1/.well-known/jwks.json`. Set `SUPABASE_PROJECT_URL`
   and we fetch + cache the JWKS.

Either or both env vars can be set; we pick the right path based on the
algorithm declared in the token header.

Environment variables (set in `backend/.env`):
    SUPABASE_PROJECT_URL  — e.g. https://abc123.supabase.co
                            (required for ES256/RS256 tokens)
    SUPABASE_JWT_SECRET   — the legacy "JWT Secret"
                            (required for HS256 tokens)
    SUPABASE_AUTH_DISABLED — set to "1" to bypass auth entirely (dev only)
"""
from __future__ import annotations
import os
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


VALID_ROLES = {"customer", "agent", "manager", "admin"}

# Algorithms Supabase may use. HS256 = legacy shared secret;
# ES256 / RS256 = newer asymmetric "JWT Signing Keys".
SUPPORTED_ALGS = {"HS256", "ES256", "RS256"}


def _auth_disabled() -> bool:
    return os.getenv("SUPABASE_AUTH_DISABLED", "").strip() in ("1", "true", "yes")


def _project_url() -> str:
    url = os.getenv("SUPABASE_PROJECT_URL", "").strip().rstrip("/")
    return url


def _jwt_secret() -> str:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()


# Cached JWKS client — lazily built on first use, reused across requests.
_jwk_client: Optional[PyJWKClient] = None
_jwk_client_url: Optional[str] = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client, _jwk_client_url
    base = _project_url()
    if not base:
        raise HTTPException(
            status_code=500,
            detail=(
                "Server misconfigured: SUPABASE_PROJECT_URL not set. "
                "Required to verify ES256/RS256-signed Supabase tokens."
            ),
        )
    jwks_url = f"{base}/auth/v1/.well-known/jwks.json"
    if _jwk_client is None or _jwk_client_url != jwks_url:
        # cache_keys=True keeps fetched JWKS in memory; lifespan=3600s default.
        _jwk_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        _jwk_client_url = jwks_url
    return _jwk_client


def _decode_token(token: str) -> dict:
    """Verify a Supabase JWT and return its claims.

    Picks the verification key based on the token's `alg`:
        HS256        → SUPABASE_JWT_SECRET
        ES256/RS256  → public key from the project's JWKS endpoint
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")

    alg = (header.get("alg") or "").upper()
    if alg not in SUPPORTED_ALGS:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f"Unsupported token algorithm: {alg or 'unknown'}",
        )

    decode_kwargs = dict(
        algorithms=[alg],
        audience="authenticated",
        # Supabase doesn't always set `iss` consistently across legacy vs new
        # tokens — leave issuer un-verified, the signature check is what matters.
        options={"verify_iss": False},
    )

    try:
        if alg == "HS256":
            secret = _jwt_secret()
            if not secret:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Server misconfigured: SUPABASE_JWT_SECRET not set. "
                        "Required for HS256 tokens."
                    ),
                )
            return jwt.decode(token, secret, **decode_kwargs)
        else:  # ES256 / RS256
            signing_key = _get_jwk_client().get_signing_key_from_jwt(token).key
            return jwt.decode(token, signing_key, **decode_kwargs)
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token audience")
    except jwt.PyJWKClientError as e:
        # JWKS fetch failed — almost always a misconfigured SUPABASE_PROJECT_URL
        # or a network problem.
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f"Could not fetch JWKS: {e}",
        )
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
