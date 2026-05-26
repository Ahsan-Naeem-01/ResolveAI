# Supabase Authentication — Setup Guide

ResolveAI uses [Supabase Auth](https://supabase.com/docs/guides/auth) for
sign-up / sign-in. The frontend talks to Supabase directly; the FastAPI
backend verifies the resulting JWT on every protected request.

The backend supports both legacy **HS256** (symmetric "JWT Secret") and
modern **ES256 / RS256** (asymmetric "JWT Signing Keys") tokens, picking
the verification path from the algorithm in the token header. New Supabase
projects default to ES256 and you only need to set `SUPABASE_PROJECT_URL`;
legacy projects need `SUPABASE_JWT_SECRET` instead.

## 1 · Create a Supabase project

1. Go to <https://supabase.com> and sign up (free tier is fine).
2. Click **New project** → choose a name + region → set a database password.
3. Wait ~1 minute for it to provision.

## 2 · Grab the keys

In the project dashboard, open **Project Settings → API**.

**For new projects** (asymmetric ES256 — the current default):

| Value | Used by | Where it goes |
|-------|---------|---------------|
| **Project URL** (e.g. `https://abc123.supabase.co`) | frontend + backend | `VITE_SUPABASE_URL` and `SUPABASE_PROJECT_URL` |
| **`anon` public key** | frontend | `VITE_SUPABASE_ANON_KEY` |

The backend fetches the public signing key from
`<project-url>/auth/v1/.well-known/jwks.json` automatically — there is no
secret to copy. `SUPABASE_JWT_SECRET` should stay blank.

**For legacy projects** (HS256 — older projects that haven't rotated keys):

| Value | Used by | Where it goes |
|-------|---------|---------------|
| **Project URL** | frontend + backend | `VITE_SUPABASE_URL` and `SUPABASE_PROJECT_URL` |
| **`anon` public key** | frontend | `VITE_SUPABASE_ANON_KEY` |
| **JWT Secret** (under "JWT Settings") | backend only | `SUPABASE_JWT_SECRET` |

> ⚠️ **The JWT Secret is sensitive.** It must NOT ship to the browser.

The backend auto-detects which path to use based on the `alg` header in
each incoming token, so it's safe to leave both `SUPABASE_PROJECT_URL` and
`SUPABASE_JWT_SECRET` set if you're unsure which format your project
issues.

## 3 · Configure auth providers

Open **Authentication → Providers**:

- Make sure **Email** is enabled (it is by default).
- For local dev, you may want to disable "Confirm email" so that newly
  created accounts can log in immediately:
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
# Required for new (ES256) projects:
SUPABASE_PROJECT_URL=https://YOUR-PROJECT-REF.supabase.co

# Only needed for legacy (HS256) projects — leave blank otherwise:
SUPABASE_JWT_SECRET=
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

## 6 · Install dependencies

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

When a user signs up, the React app stores their chosen role inside
Supabase's `user_metadata` (`{ role: "customer" | "agent" | "manager" |
"admin" }`). That value is embedded in the access-token JWT and read by
the backend.

On every protected request, the backend `auth.py`:

1. Picks HS256 vs ES256/RS256 from the token header.
2. Verifies the signature (against `SUPABASE_JWT_SECRET` or the JWKS).
3. Validates `aud == "authenticated"` and expiration.
4. Upserts a row in the local `users` table keyed by email — so the
   ticket / reply / assignee foreign keys reference a real local user.
5. Picks the role with precedence `app_metadata.role > user_metadata.role
   > "customer"`.

### Promoting a user (e.g. making an agent into an admin)

`user_metadata` is editable by the user themselves, so for trusted role
elevation use `app_metadata` instead — it can only be set by an admin via
the Supabase dashboard or service-role API.

To promote a user:

1. Go to **Authentication → Users** in the Supabase dashboard.
2. Click the user row.
3. Edit **Raw App Meta Data** to:
   ```json
   { "role": "admin" }
   ```
4. The user must sign out and sign back in for the new token to take
   effect.

### Locking down sign-up

By default, the AuthScreen lets a new user pick any role. To prevent
random sign-ups from claiming `agent` / `manager` / `admin`:

- Easiest: edit `frontend-vite/src/screens/AuthScreen.jsx` and remove the
  staff entries from `ROLE_OPTIONS` so anyone signing up is forced to pick
  `customer`. Then promote staff manually via `app_metadata` (see above).
- Stricter: in Supabase, enable **Authentication → Providers → Email →
  "Allow new users to sign up" = off**, then create staff accounts
  manually via the dashboard with the right `app_metadata.role`.

## 9 · What's protected

| Endpoint | Required role |
|----------|---------------|
| `POST /api/tickets/process` | `customer` (only logged-in customers can submit) |
| `GET /api/tickets`, `PATCH/POST /api/tickets/{code}/...` (reply, regenerate, send, status, assign, route) | `agent`, `manager`, `admin` |
| `GET /api/tickets/{code}` | staff (any) **or** the customer who owns the ticket |
| `GET /api/tickets/{code}/messages`, `POST .../messages` | staff **or** the ticket owner |
| `GET /api/tickets/customer/me` | any authenticated user (returns `[]` for staff) |
| `GET /api/tickets/_meta/departments` | staff |
| `GET /api/analytics/manager`, `GET /api/analytics/shifts` | `manager`, `admin` |
| `GET /api/analytics/admin` | `admin` |
| `/api/agents` | staff |
| `GET /api/agents/me` | any authenticated user |
| `/api/kb/*` (list, get, create, update, delete, feedback, insert, suggest) | staff |
| `GET /api/health`, `GET /api/faq`, `GET /api/llm/status` | public |

A request without a valid bearer token returns **401**. A request from a
user without sufficient privilege returns **403**.

## 10 · Dev escape hatch

Set `SUPABASE_AUTH_DISABLED=1` in `backend/.env` to bypass JWT verification
entirely — every request is treated as `dev@resolveai.app` (admin). Useful
for local debugging when you don't want to mess with tokens, but never
leave this on in any deployed environment.

## Troubleshooting

- **"The specified alg value is not allowed"** — your project issues
  asymmetric (ES256) tokens but `SUPABASE_PROJECT_URL` is unset. Fill it
  in and restart the backend. (The backend auto-fetches the public key
  from the JWKS endpoint.)
- **"Server misconfigured: SUPABASE_PROJECT_URL not set"** — same as
  above.
- **"Server misconfigured: SUPABASE_JWT_SECRET not set"** — your project
  issues legacy HS256 tokens. Paste the "JWT Secret" from the dashboard
  into `backend/.env` and restart.
- **"Could not fetch JWKS: ..."** — the JWKS endpoint isn't reachable
  from the backend. Check the project URL is correct and the backend host
  has internet access.
- **"Invalid token: ..."** — usually means the project URL or JWT secret
  in `backend/.env` doesn't match the project that issued the token (e.g.
  you switched Supabase projects but didn't update the env).
- **Can't sign up** — make sure email auth is enabled in Supabase, and
  that "Confirm email" is off for local dev (otherwise check your inbox
  for the confirmation link).
- **403 Forbidden after signing up** — your `user_metadata.role` doesn't
  match the screen you're trying to view. Sign out, sign up again with
  the correct role, or promote yourself via `app_metadata` in the
  dashboard.
- **"Supabase is not configured" banner on the auth screen** — the Vite
  app didn't see `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Check
  `frontend-vite/.env` exists, the vars are spelled correctly, and
  restart `npm run dev` so Vite re-reads `.env`.
