# How to run

> **First time?** Set up Supabase Auth before running anything — see
> [SUPABASE_SETUP.md](SUPABASE_SETUP.md). You need a `backend/.env` and a
> `frontend-vite/.env` with the right keys, otherwise login/signup will
> fail.

## 1 · Backend

Install dependencies (run from the repo root):

```bash
pip install -r backend/requirements.txt
```

Start the dev server (listens on `:8000`, auto-reload on code changes):

```bash
python -m backend.run
```

On first boot the lifespan hook:
- creates `backend/resolveai.db` (SQLite)
- seeds demo users, FAQs, knowledge-base articles, and tickets
- trains the intent classifier from
  `backend/app/nlp/training_data.csv` (1,400 examples · 7 intents) and
  caches it at `backend/app/nlp/_intent_model.joblib`

Wipe and re-seed:

```bash
rm backend/resolveai.db backend/app/nlp/_intent_model.joblib
python -m backend.run
```

## 2 · Frontend (Vite)

Install dependencies (first run only):

```bash
cd frontend-vite
npm install
```

Start the Vite dev server (listens on `:5173`, proxies `/api` → `:8000`):

```bash
npm run dev
```

Open <http://localhost:5173>.

## 3 · Single-process production build (optional)

Build the SPA, then run only the backend — it auto-detects
`frontend-vite/dist` and serves the SPA from `/`:

```bash
cd frontend-vite && npm install && npm run build && cd ..
python -m backend.run
```

Open <http://localhost:8000>.

## 4 · Optional integrations

Set these in `backend/.env` to enable extra features (each works without
any config — the app falls back gracefully):

| Variable | Effect |
|----------|--------|
| `GROQ_API_KEY` | Enable live LLM reply drafting via Groq |
| `GROQ_MODEL` | Override the LLM (default `llama-3.3-70b-versatile`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Send real emails when routing a ticket; without these, routes are simulated |
| `SUPABASE_AUTH_DISABLED=1` | Dev only — bypass JWT verification, treat every request as admin |

Interactive Swagger docs at <http://localhost:8000/docs>.
