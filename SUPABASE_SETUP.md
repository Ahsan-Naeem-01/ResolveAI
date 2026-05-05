# Supabase Authentication — Setup Guide

ResolveAI uses [Supabase Auth](https://supabase.com/docs/guides/auth) for
sign-up / sign-in. The frontend talks to Supabase directly; the FastAPI
backend verifies the resulting JWT on every protected request.

## 1 · Create a Supabase project

1. Go to <https://supabase.com> and sign up (free tier is fine).
2. Click **New project** → choose a name + region → set a database password.
3. Wait ~1 minute for it to provision.

## 2 · Grab the keys

In the project dashboard, open **Project Settings → API**. You need three
values:

| Value | Used by | Where it goes |
|-------|---------|---------------|
| **Project URL** (e.g. `https://abc123.supabase.co`) | frontend + backend | `VITE_SUPABASE_URL` and `SUPABASE_PROJECT_URL` |
| **`anon` public key** (long JWT) | frontend | `VITE_SUPABASE_ANON_KEY` |
| **JWT Secret** (under "JWT Settings") | backend only | `SUPABASE_JWT_SECRET` |

> ⚠️ **The JWT Secret is sensitive.** It must NOT ship to the browser. Only
> the backend uses it (to verify signed access tokens).

## 3 · Configure auth providers

Open **Authentication → Providers**:

- Make sure **Email** is enabled (it is by default).
- For local dev, you may want to disable "Confirm email" so that newly created
  accounts can log in immediately:
  **Authentication → Providers → Email → Confirm email = off**.

(In production, leave email confirmation **on**.)

## 4 · Configure redirect URLs

Open **Authentication → URL Configuration** and add these to the allowed
redirect / site URLs:

```
http://localhost:5173
http://localhost:8000
```

## 5 · Drop the keys into the project

### Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
SUPABASE_JWT_SECRET=<paste the JWT Secret>
SUPABASE_PROJECT_URL=https://YOUR-PROJECT-REF.supabase.co
```

### Frontend

```bash
cp frontend-vite/.env.example frontend-vite/.env
```

Edit `frontend-vite/.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=<paste the anon public key>
```

## 6 · Install the new dependencies

```bash
# backend
pip install -r backend/requirements.txt

# frontend
cd frontend-vite && npm install
```

## 7 · Run the app

```bash
# terminal 1
python -m backend.run

# terminal 2
cd frontend-vite && npm run dev
```

Open <http://localhost:5173>. You should see the sign-in screen.

## 8 · How roles work

When a user signs up, the React app stores their chosen role inside Supabase's
`user_metadata` (`{ role: "customer" | "agent" | "manager" | "admin" }`).
That value is embedded in the access-token JWT and read by the backend.

### Promoting a user (e.g. making an agent into an admin)

`user_metadata` is editable by the user themselves, so for trusted role
elevation you should use `app_metadata` instead — it can only be set by an
admin via the Supabase dashboard or service-role API.

The backend prefers `app_metadata.role` over `user_metadata.role`. To promote
a user:

1. Go to **Authentication → Users** in the Supabase dashboard.
2. Click the user row.
3. Edit **Raw App Meta Data** to:
   ```json
   { "role": "admin" }
   ```
4. The user must sign out and sign back in for the new token to take effect.

### Locking down sign-up

By default, the AuthScreen lets a new user pick any role. To prevent random
sign-ups from claiming `agent` / `manager` / `admin`:

- Easiest: edit `frontend-vite/src/screens/AuthScreen.jsx` and remove the
  staff entries from `ROLE_OPTIONS` so anyone signing up is forced to pick
  `customer`. Then promote staff manually via `app_metadata` (see above).
- Stricter: in Supabase, enable **Authentication → Providers → Email →
  "Allow new users to sign up" = off**, then create staff accounts manually
  via the dashboard with the right `app_metadata.role`.

## 9 · What's protected

| Endpoint | Required role |
|----------|---------------|
| `POST /api/tickets/process` | `customer` (only logged-in customers can submit) |
| `GET /api/tickets`, `GET /api/tickets/{code}` (full access) | `agent`, `manager`, `admin` |
| `GET /api/tickets/{code}` (own ticket only) | `customer` |
| `PATCH/POST /api/tickets/{code}/...` | `agent`, `manager`, `admin` |
| `GET /api/analytics/manager` | `manager`, `admin` |
| `GET /api/analytics/admin` | `admin` |
| `/api/agents`, `/api/kb/*` | staff (`agent`, `manager`, `admin`) |
| `GET /api/agents/me` | any authenticated user |
| `GET /api/health`, `GET /api/faq`, `GET /api/llm/status` | public |

A request without a valid bearer token returns **401**. A request from a
user without sufficient privilege returns **403**.

## Troubleshooting

- **"Server misconfigured: SUPABASE_JWT_SECRET not set"** — `backend/.env`
  is missing or wasn't loaded. Restart the backend after editing `.env`.
- **"Invalid token: ..."** — usually means the JWT secret in `backend/.env`
  doesn't match the one in the Supabase dashboard. Double-check you copied
  the **JWT Secret** (not the anon key).
- **Can't sign up** — make sure email auth is enabled in Supabase, and that
  "Confirm email" is off for local dev (otherwise check your inbox for the
  confirmation link).
- **403 Forbidden after signing up** — your `user_metadata.role` doesn't
  match the screen you're trying to view. Sign out, sign up again with the
  correct role, or promote yourself via `app_metadata` in the dashboard.
