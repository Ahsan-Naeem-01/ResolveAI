"""ResolveAI FastAPI app — exposes the NLP-backed support API and serves the frontend."""
from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path

# Load environment variables from backend/.env (e.g. GROQ_API_KEY) before any
# of our modules import settings or call os.getenv. Silently no-ops if dotenv
# isn't installed or the file doesn't exist.
try:
    from dotenv import load_dotenv

    _ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
    if _ENV_FILE.exists():
        load_dotenv(_ENV_FILE)
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import tickets, analytics, agents, faq
from . import seed as seed_module


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_module.seed()
    yield


app = FastAPI(
    title="ResolveAI API",
    version="1.0",
    description="NLP-powered customer support intelligence backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo — tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)
app.include_router(analytics.router)
app.include_router(agents.router)
app.include_router(faq.router)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "resolveai", "version": "1.0"}


@app.get("/api/llm/status")
def llm_status():
    """Report whether the live LLM (Groq) is configured."""
    from .nlp import llm

    return {
        "enabled": llm.is_enabled(),
        "model": llm._model() if llm.is_enabled() else None,
        "provider": "groq" if llm.is_enabled() else None,
    }


# ── Static frontend ────────────────────────────────────────────────
# Serves the built Vite app at frontend-vite/dist when present. In dev,
# the Vite dev server (port 5173) handles the UI and proxies /api here.
ROOT = Path(__file__).resolve().parent.parent.parent
VITE_DIST = ROOT / "frontend-vite" / "dist"


def _mount_frontend():
    if not VITE_DIST.exists():
        return

    if (VITE_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=VITE_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa_catchall(full_path: str):
        target = VITE_DIST / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(VITE_DIST / "index.html")


_mount_frontend()
