"""SQLAlchemy engine + session.

Database selection:
    DATABASE_URL env var  → use it (e.g. Postgres on Render/Supabase/Neon)
    otherwise             → local SQLite at backend/resolveai.db (dev default)

Render/Supabase Postgres URLs that start with `postgres://` are silently
rewritten to `postgresql+psycopg2://` so SQLAlchemy 2 accepts them.
"""
from __future__ import annotations
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = Path(__file__).resolve().parent.parent / "resolveai.db"
_DEFAULT_SQLITE_URL = f"sqlite:///{DB_PATH}"


def _resolve_database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        return _DEFAULT_SQLITE_URL
    # Heroku/Render/Supabase historically hand out `postgres://...` — SQLAlchemy
    # 2 requires the dialect-qualified form.
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg2://" + raw[len("postgres://"):]
    return raw


DATABASE_URL = _resolve_database_url()

# SQLite needs `check_same_thread=False` for FastAPI's threadpool; Postgres
# doesn't, and passing it would raise.
_is_sqlite = DATABASE_URL.startswith("sqlite")
_engine_kwargs = {"echo": False, "future": True}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Free-tier Postgres providers idle-close connections aggressively.
    # pre_ping reissues a `SELECT 1` so we don't hand a dead conn to a request.
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
