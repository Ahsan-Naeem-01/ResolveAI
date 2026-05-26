"""Dev entry point. Run from the repo root: `python -m backend.run`.

Do NOT `cd backend && python run.py` — the app is loaded by its dotted path
(`backend.app.main:app`), which requires the repo root on `sys.path`.
"""
import uvicorn


def main():
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"],
    )


if __name__ == "__main__":
    main()
