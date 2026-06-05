# Deploying ResolveAI (free tier)

This guide deploys the app split across two hosts:

| Layer | Host | Free quota |
|-------|------|-----------|
| Frontend (Vite SPA) | **Vercel** | Hobby — unlimited static deploys, no sleep |
| Backend (FastAPI) | **Render** | 750 hrs/mo Web Service, sleeps after 15 min idle |
| Database (Postgres) | **Supabase** | 500 MB DB, 5 GB bandwidth |
| Auth | **Supabase Auth** | 50K MAU |
| LLM (optional) | **Groq** | Free, generous |

Total cost: **$0/mo**.

---

## 0 · Prerequisites

- A GitHub account with this repo pushed (the `Deployment` branch).
- Accounts on: [Vercel](https://vercel.com), [Render](https://render.com), [Supabase](https://supabase.com).
- Optional: [Groq](https://console.groq.com) for live LLM replies.

---

## 1 · Supabase — Postgres database + Auth

You're likely already using Supabase Auth, so you may already have a project.
We'll reuse it for the Postgres database too.

1. Open your project at https://supabase.com/dashboard.
2. **Project Settings → Database → Connection string → URI**. Copy the
   `postgresql://postgres:[YOUR-PASSWORD]@db.<ref>.supabase.co:5432/postgres`
   URL. Replace `[YOUR-PASSWORD]` with the DB password (shown right above).
   - Save this — you'll paste it into Render as `DATABASE_URL`.
3. **Project Settings → API**:
   - Copy `Project URL` → this is `SUPABASE_PROJECT_URL` (backend) and
     `VITE_SUPABASE_URL` (frontend).
   - Copy `anon public` key → this is `VITE_SUPABASE_ANON_KEY` (frontend).
   - If your project still uses the legacy HS256 JWT (older projects):
     copy `JWT Secret` → `SUPABASE_JWT_SECRET` (backend). New projects can
     leave this blank.

> The backend automatically picks HS256 vs ES256/RS256 based on the token
> header — set whichever your project uses.

---

## 2 · Render — backend (FastAPI)

### 2a · Create the service

1. Push the `Deployment` branch to GitHub if you haven't already
   (`git push -u origin Deployment`).
2. Go to https://dashboard.render.com → **New** → **Blueprint**.
3. Connect your GitHub and pick this repo.
4. Render detects the [`render.yaml`](render.yaml) at the repo root and
   shows the `resolveai-backend` service. Click **Apply**.

### 2b · Set the environment variables

Render will prompt you for the `sync: false` env vars from the blueprint.
Fill in:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | The Supabase Postgres URL from step 1.2 |
| `SUPABASE_PROJECT_URL` | The Supabase project URL from step 1.3 |
| `SUPABASE_JWT_SECRET` | Only if your project uses legacy HS256; otherwise leave blank |
| `FRONTEND_ORIGIN` | **Leave blank for now** — fill in after step 3 |
| `GROQ_API_KEY` | Optional, from Groq console |

### 2c · Wait for the first deploy

- Build takes ~3–5 min (installing scikit-learn is the slow step).
- On boot, the lifespan hook creates tables in Postgres, seeds demo users +
  FAQs + KB articles, and trains the classifier (~10–20 s).
- Watch the logs — successful boot ends with `Application startup complete.`
- Copy the public URL Render gives you, e.g.
  `https://resolveai-backend.onrender.com`. Sanity-check:
  `curl https://resolveai-backend.onrender.com/api/health` → `{"ok": true, ...}`.

---

## 3 · Vercel — frontend (Vite SPA)

### 3a · Create the project

1. Go to https://vercel.com/new and import this repo.
2. **Root Directory** → set to `frontend-vite`.
3. **Framework Preset** → Vite (auto-detected).
4. Vercel reads [`frontend-vite/vercel.json`](frontend-vite/vercel.json) for
   build settings and SPA-rewrite rules.

### 3b · Set the environment variables

Under **Environment Variables**, add (all three scopes: Production /
Preview / Development):

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | From step 1.3 |
| `VITE_SUPABASE_ANON_KEY` | From step 1.3 |
| `VITE_API_BASE_URL` | The Render URL from step 2.3 (e.g. `https://resolveai-backend.onrender.com`) |

### 3c · Deploy

Click **Deploy**. First build takes ~1 min. Vercel gives you a URL like
`https://resolveai.vercel.app`.

---

## 4 · Tell the backend who the frontend is

Now lock CORS down to the Vercel origin:

1. Render → `resolveai-backend` → **Environment** → edit `FRONTEND_ORIGIN`.
2. Paste your Vercel URL (no trailing slash):
   `https://resolveai.vercel.app`
3. Save. Render redeploys automatically (~3 min).

Preview deploys (`*-git-<branch>-<you>.vercel.app`) are also allowed by the
regex in [`backend/app/main.py`](backend/app/main.py).

---

## 5 · Smoke test

1. Open your Vercel URL.
2. Sign up as a `customer`. Sign in.
3. Submit a query like *"Where is my order #12345?"* — the AI processing
   animation should run and a structured result should appear.
4. Sign in as an `agent` (or set your role to `agent` in Supabase Auth
   metadata) — the staff dashboard with the seeded demo tickets should load.

If the first request stalls 30 s, that's Render waking the free-tier service.
Subsequent requests are instant.

---

## 6 · Updates

```bash
git push origin Deployment      # Render auto-deploys backend
                                # Vercel auto-deploys frontend
```

Or merge `Deployment` → `main` and switch both providers to track `main`
(Render: edit `branch:` in `render.yaml`; Vercel: Project Settings →
Production Branch).

---

## Troubleshooting

**"500 — Server misconfigured: SUPABASE_..."**
The relevant Supabase env var is missing on Render. Check step 2b.

**Frontend loads but every API call is CORS-blocked**
`FRONTEND_ORIGIN` on Render isn't set or doesn't match your Vercel URL
exactly. Check step 4.

**"Database is locked" / "no such table"**
You left `DATABASE_URL` unset and Render is using ephemeral SQLite that gets
wiped each restart. Set `DATABASE_URL` (step 2b).

**Build fails on `psycopg2-binary`**
Render uses Python 3.11 (pinned in `render.yaml`). Don't change that — newer
Pythons sometimes lack prebuilt wheels for `psycopg2-binary` and the build
will try (and fail) to compile from source.

**Backend slow / 502 on first request**
Render free-tier sleep. The classifier also retrains on boot (~10 s). To
keep it warm, use a pinger like https://cron-job.org → hit
`/api/health` every 10 min.

**Frontend can't reach backend in production**
`VITE_API_BASE_URL` must be set in Vercel **at build time** — Vite bakes it
into the bundle. If you change it, **redeploy** (Project → Deployments →
"Redeploy" the latest production deploy).

**Want to inspect the live DB**
Use Supabase Studio (Project → Table Editor). All the tables from
[`backend/app/models.py`](backend/app/models.py) appear there after first boot.
