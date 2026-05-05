
# How to run

> **First time?** Set up Supabase Auth before running anything — see
> [SUPABASE_SETUP.md](SUPABASE_SETUP.md). You need a `backend/.env` and a
> `frontend-vite/.env` with the right keys, otherwise login/signup will fail.

## Backend

From the repo root:

```bash
pip install -r backend/requirements.txt
```

Then:

```bash
python -m backend.run
```

## Frontend (Vite)

From the repo root:

```bash
cd frontend-vite
npm run dev
```

