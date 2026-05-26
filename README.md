# ResolveAI — Smart Customer Support Intelligence

End-to-end implementation of the platform spec'd in [`project.md`](project.md).
NLP pipeline classifies customer queries, extracts entities, retrieves similar
resolved cases, drafts replies, and routes tickets — backed by a real SQLite
database, a FastAPI backend, and a Vite + React frontend. Authentication is
handled by Supabase, with per-role guards enforced server-side
(see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)). Reply drafting can optionally
call a live LLM (Groq) and gracefully falls back to deterministic templates
when no key is set.

## Architecture

```
┌─────────────────────────┐     /api/*      ┌──────────────────────────────┐
│  Vite + React           │◄───────────────►│  FastAPI  (port 8000)        │
│  (port 5173 in dev)     │                 │  ├── routers/                │
│  ├── AuthScreen         │                 │  │   ├── tickets.py          │
│  ├── PortalLayout       │                 │  │   ├── analytics.py        │
│  │   └── CustomerScreen │                 │  │   ├── agents.py           │
│  │       (+ ChatPanel,  │                 │  │   ├── kb.py               │
│  │          FAQCenter)  │                 │  │   └── faq.py              │
│  └── AppShell           │                 │  ├── nlp/                    │
│      ├── AgentScreen    │   Supabase JWT  │  │   ├── pipeline.py         │
│      │   (+ KnowledgeBase, ChatPanel)     │  │   ├── classifier.py       │
│      ├── ManagerScreen  │ ◄─────────────► │  │   ├── entities.py         │
│      │   (Performance, Live Queue,        │  │   ├── keywords.py         │
│      │    Agents, Shifts & coverage)      │  │   ├── sentiment.py        │
│      └── AdminScreen    │                 │  │   ├── urgency.py          │
└─────────────────────────┘                 │  │   ├── semantic_search.py  │
        │                                   │  │   ├── response.py         │
        ▼                                   │  │   ├── routing.py          │
   Supabase Auth                            │  │   ├── preprocess.py       │
   (sign in / sign up)                      │  │   └── llm.py  (Groq)      │
                                            │  ├── auth.py   (JWT verify) │
                                            │  ├── email_utils.py (SMTP)  │
                                            │  └── models.py (SQLAlchemy) │
                                            │              ▼               │
                                            │       resolveai.db           │
                                            └──────────────────────────────┘
```

## Stack

- **Backend**: FastAPI 0.115, SQLAlchemy 2, SQLite, scikit-learn 1.5,
  PyJWT (Supabase JWT verification — HS256 and ES256/RS256), httpx
  (Groq client), stdlib `smtplib` (department routing emails)
- **NLP**: TF-IDF + Logistic Regression intent classifier (~1,400 labeled
  examples · 200 per intent · 7 intents), regex+catalog entity extraction,
  TF-IDF cosine similarity for semantic search, lexicon-based sentiment with
  negation/intensifier windows, rule + sentiment-driven urgency, optional
  live LLM reply generation via Groq with a template fallback
- **Frontend**: React 18, Vite 5, Supabase JS client, code-split screens,
  ErrorBoundary, skeleton loaders, slate + indigo design system, ⌘K command
  palette, dependency-free markdown renderer

## Quick start (dev)

Two terminals.

**Backend** (installs deps, trains the classifier, seeds demo tickets, starts
on `:8000`):  
From project root:
```bash
python -m pip install -r backend/requirements.txt
python -m backend.run
```

**Frontend** (Vite dev server on `:5173`, proxies `/api` → `:8000`):

```bash
cd frontend-vite
npm install
npm run dev
```

Open <http://localhost:5173>. Both Supabase env files must be present before
the app boots — see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Quick start (single process, prod-ish)

Build the frontend, then run the backend — it auto-detects
`frontend-vite/dist` and serves the SPA at `/` while exposing the API at
`/api/*`. All commands run from the project root:

```bash
cd frontend-vite && npm install && npm run build && cd ..
python -m pip install -r backend/requirements.txt
python -m backend.run
```

Open <http://localhost:8000>.

> Always launch the backend from the repo root with `python -m backend.run`.
> Running `python run.py` from inside `backend/` fails with
> `ModuleNotFoundError: No module named 'backend'` because the app is loaded
> by its dotted path (`backend.app.main:app`), which only resolves when the
> repo root is on `sys.path`.

## What works

### Customer help portal
- Public-facing surface with its own layout (no sidebar)
- Three tabs: **New request** · **My tickets** · **Help center**
- New request:
  - Free-form natural-language input with attachment + order-link affordances
  - Suggestion chips for common issues
  - Live AI processing animation showing all NLP steps with real timings
  - Structured AI result: intent + confidence, urgency, sentiment, extracted
    order/product/date entities, keywords, similar resolved cases (TF-IDF
    cosine), routed department, suggested reply
- My tickets:
  - List of tickets the customer has submitted with unread-from-agent count
  - **Live chat thread** per ticket (polling `/api/tickets/{code}/messages`)
    so customer and agent can converse without leaving the page
  - Re-opens a resolved ticket automatically when the customer replies
- Help center (FAQs): grouped by intent with thumbs-up/down feedback
  (stored in localStorage) and a "Submit a request" CTA that seeds the
  textarea with the FAQ topic

### Authentication
- Sign-up / sign-in screen powered by Supabase Auth
- Role picker on sign-up (`customer / agent / manager / admin`) saved into
  Supabase `user_metadata`
- Frontend session persisted by the Supabase client; bearer token attached
  to every `/api/*` call
- Backend verifies the JWT (auto-detects HS256 vs ES256/RS256 by token
  header) and enforces per-role guards on every protected endpoint
- Local `users` table is upserted on first sign-in; role precedence is
  `app_metadata.role > user_metadata.role > "customer"`

### Staff app shell (Agent / Manager / Admin)
- Persistent sidebar nav with role-specific items + active highlight
- Top header with breadcrumb + per-role actions
- **⌘K command palette** — searches tickets, KB articles, and agents;
  selection emits a `resolveai:navigate` event the active screen handles
- User menu (lower-left) with theme toggle and sign-out
- Skeleton loaders during data fetch
- Error boundary catches any render failure with a recoverable UI
- Responsive: sidebar collapses to a drawer on small screens

### Agent workspace
- Filterable inbox (All / Critical / High / Needs review) backed by
  `/api/tickets`; sidebar tabs select between **All tickets · Drafts ·
  Watching (unassigned) · Needs review · Auto-resolved · Escalated** —
  each maps to a server-side filter
- Ticket detail with extracted fields, AI-drafted reply
- Editable reply textarea; **Save draft**, **Send**, **Regenerate** with
  warm/concise/formal tone variants — actually re-runs the pipeline
  server-side and shows whether the reply came from the live LLM or the
  template fallback
- **Assign** / **Route to department** actions
  - Assign: pick any agent (or "to me") → `POST /api/tickets/{code}/assign`
  - Route: pick a department + recipient email → composes a forwarding email
    with the original ticket context and sends via SMTP (or simulates if
    SMTP isn't configured); logged to `routing_logs`
- **Knowledge base** tab — search, browse by category/tag, read articles,
  thumbs-up/down feedback, "Insert into reply" (which increments usage
  metrics on the article)
- **Live chat panel** so the agent and customer can have a back-and-forth
  conversation on the same ticket

### Support manager dashboard
Sidebar tabs: **Team performance · Live queue · Agents · Shifts & coverage**
(plus coming-soon placeholders for SLA monitor, Coaching, Complaint trends,
Macro performance).

- **Team performance**: KPIs (open tickets, avg resolution time, AI
  auto-resolve %, CSAT — all computed from the live database) with
  sparkline trends; 12-bucket hourly volume chart for today; 7-day SLA
  compliance per urgency level; per-agent performance table (handled / AHT
  / CSAT / AI assist rate)
- **Live queue**: all open tickets (ai-suggested / needs-review / escalated)
  with per-ticket SLA countdowns, breach highlights, filter chips
  (unassigned / breached / critical / escalated), polls every 15 s and
  pauses when the tab is hidden, supports in-line reassignment
- **Agents**: per-agent cards with load (open assigned), AHT, CSAT and AI
  assist rate; detail pane allows reassigning their tickets
- **Shifts & coverage**: deterministic 7-day shift roster synthesized from
  the agent list (morning / afternoon / evening / off), demand curve
  computed from the last 4 same-weekdays of real ticket history, capacity
  vs demand chart per hour, gap detection ("short by N agents at 3p")

### Business admin dashboard
- KPIs: total volume, cost-per-ticket (computed: $0.30 auto-resolved +
  $4.20 human-handled), refund $ flagged, CSAT
- Donut: ticket-intent distribution
- Top product issues (aggregated from extracted product entities)
- 7×24 ticket-arrival heatmap (last 4 weeks)

### NLP pipeline (`POST /api/tickets/process`)
1. **Preprocessing** — tokenize, lowercase, normalize
2. **Intent classification** — TF-IDF (1–2 gram) + LogisticRegression,
   7 classes
3. **Entity extraction** — regex (order_id, tracking, money, email, date)
   + catalog match (10 SKUs)
4. **Keyword extraction** — TF-IDF top-k against the training corpus with a
   high-signal support-vocabulary boost
5. **Sentiment** — hand-curated polarity lexicon with negation/intensifier
   windows; produces a label (Angry / Frustrated / Worried / …) and a
   signed score
6. **Urgency** — intent priors + critical/high regex cues + sentiment ⇒
   Critical / High / Medium / Low
7. **Semantic search** — TF-IDF + cosine over training examples + resolved
   tickets, top-3 with similarity scores
8. **Solution recommendation** — intent-keyed action templates aware of
   extracted entities
9. **Reply generation** — tries Groq (`llama-3.3-70b-versatile` by default)
   first; falls back to an empathy-aware template with tone variants
   (warm / concise / formal / apologetic) that substitutes name + order +
   product
10. **Routing** — intent → Finance / Logistics / Support / Fraud-Security
11. **Aggregation** — structured JSON in the `project.md` §10 shape, plus
    per-step timings for the customer animation, plus `reply_source`
    ("llm" or "template")

## Frontend optimizations

- **Code splitting**: each screen is `React.lazy()`'d into its own chunk
- **Error boundary** wraps the app — render failures show a reload-recover UI
- **Skeleton loaders** instead of spinners for KPI rows, cards, ticket lists
- **CSS variables** for the entire palette — instant dark mode toggle
- **State persistence** to localStorage (theme; Supabase session managed by
  the Supabase client itself)
- **Chat polling pauses** when the document is hidden (Page Visibility API)
- **Live queue polling pauses** when the manager's tab is hidden

## API reference

### Auth & meta
| Method | Path | What it does |
|--------|------|--------------|
| GET    | `/api/health` | Liveness check (public) |
| GET    | `/api/llm/status` | Whether Groq LLM is enabled + which model (public) |
| GET    | `/api/faq` | List FAQs (optional `intent` filter, public) |

### Tickets
| Method | Path | What it does |
|--------|------|--------------|
| POST   | `/api/tickets/process` | Run the NLP pipeline on a query, persist a ticket (customer only) |
| GET    | `/api/tickets` | List tickets (staff). Filters: `status`, `urgency`, `intent`, `q`, `assignee` (me/unassigned/numeric id), `has_draft`, `limit` |
| GET    | `/api/tickets/{code}` | Ticket detail with similar cases + replies + routing history |
| PATCH  | `/api/tickets/{code}/reply` | Update the latest draft reply (staff) |
| POST   | `/api/tickets/{code}/regenerate` | Re-run pipeline; new draft (optional `tone`) |
| POST   | `/api/tickets/{code}/send` | Send the reply, mark resolved (staff) |
| POST   | `/api/tickets/{code}/status` | Update status / record CSAT (staff) |
| POST   | `/api/tickets/{code}/assign` | Assign/unassign (`assignee_id` or `to_me=true`) |
| POST   | `/api/tickets/{code}/route` | Forward to a department by email + log it |
| GET    | `/api/tickets/_meta/departments` | Routing destinations + default emails |
| GET    | `/api/tickets/{code}/messages?since=N` | Chat thread (incremental) |
| POST   | `/api/tickets/{code}/messages` | Post a chat message |
| GET    | `/api/tickets/customer/me` | A customer's own tickets (with last-message preview + unread count) |

### Analytics (role-gated)
| Method | Path | What it does |
|--------|------|--------------|
| GET    | `/api/analytics/manager` | Manager dashboard payload (manager+) |
| GET    | `/api/analytics/shifts`  | Shifts & coverage view (manager+) |
| GET    | `/api/analytics/admin`   | Admin dashboard payload (admin only) |

### Agents
| Method | Path | What it does |
|--------|------|--------------|
| GET    | `/api/agents` | List support agents (staff) |
| GET    | `/api/agents/me` | The authenticated user's local row (any signed-in user) |

### Knowledge base (staff only)
| Method | Path | What it does |
|--------|------|--------------|
| GET    | `/api/kb` | List/search articles (`q`, `category`, `status`, `intent`, `tag`, `limit`) |
| GET    | `/api/kb/categories` | Category + tag counts for the sidebar |
| GET    | `/api/kb/suggest?ticket=TKT-…&k=3` | Semantic-search articles for a ticket |
| GET    | `/api/kb/{slug}` | Article detail (increments view count) |
| POST   | `/api/kb` | Create article |
| PATCH  | `/api/kb/{slug}` | Update article |
| DELETE | `/api/kb/{slug}` | Soft-delete (sets status → archived) |
| POST   | `/api/kb/{slug}/feedback` | helpful / not-helpful counter |
| POST   | `/api/kb/{slug}/insert` | Increment "inserted into reply" counter |

Interactive Swagger docs at <http://localhost:8000/docs>.

## Project layout

```
ResolveAI/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app + static-frontend mount
│   │   ├── database.py        SQLAlchemy engine + session
│   │   ├── auth.py            Supabase JWT verification (HS256 + ES256/RS256)
│   │   ├── email_utils.py     SMTP helper for routing emails
│   │   ├── models.py          User, Ticket, Reply, Attachment, FAQ,
│   │   │                      KBArticle, TrainingExample, ModelMetric,
│   │   │                      RoutingLog
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── seed.py            Trains classifier + populates demo data
│   │   ├── nlp/               (pipeline, classifier, entities, keywords,
│   │   │                       sentiment, urgency, semantic_search,
│   │   │                       response, routing, preprocess, llm)
│   │   │   ├── training_data.csv   1,400 labeled examples (200 × 7 intents)
│   │   │   └── _intent_model.joblib (regenerated on boot)
│   │   └── routers/           (tickets, analytics, agents, faq, kb)
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py                 Dev entry point (uvicorn with reload)
├── frontend-vite/
│   ├── src/
│   │   ├── App.jsx            Theme state, lazy-loads screens, auth gate
│   │   ├── main.jsx           Wraps App in <AuthProvider>
│   │   ├── lib/
│   │   │   ├── api.js         Fetch wrapper (attaches Supabase bearer token)
│   │   │   ├── auth.jsx       Auth context (Supabase session + role)
│   │   │   ├── supabase.js    Supabase JS client
│   │   │   ├── format.js      Pill class maps
│   │   │   └── roles.js       Per-role identity + sidebar nav config
│   │   ├── components/
│   │   │   ├── AppShell.jsx     Sidebar + header (staff)
│   │   │   ├── PortalLayout.jsx Public help-portal layout (customer)
│   │   │   ├── ChatPanel.jsx    Polling chat thread
│   │   │   ├── FAQCenter.jsx    Customer-facing FAQ browser
│   │   │   ├── SearchPalette.jsx ⌘K global search
│   │   │   ├── Markdown.jsx     Dependency-free markdown renderer
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   ├── Icon.jsx
│   │   │   └── Spark.jsx
│   │   ├── screens/           AuthScreen, CustomerScreen, AgentScreen,
│   │   │                      ManagerScreen, AdminScreen, KnowledgeBase
│   │   ├── styles.css         Design tokens + components (slate + indigo)
│   │   └── app-shell.css      Layout & shell-specific styles
│   ├── index.html
│   ├── package.json
│   ├── .env.example
│   └── vite.config.js
├── project.md
├── README.md
├── HowToRun.md
└── SUPABASE_SETUP.md
```

## Database

SQLite file at `backend/resolveai.db` (created on first boot — `seed.py` runs
in the FastAPI lifespan). Wipe and re-seed:

```bash
rm backend/resolveai.db backend/app/nlp/_intent_model.joblib
python -m backend.run
```

Tables: `users`, `tickets`, `replies`, `attachments`, `faqs`, `kb_articles`,
`training_examples`, `model_metrics`, `routing_logs`.

## Customizing the NLP pipeline

- **Add training examples**: append rows to
  [`backend/app/nlp/training_data.csv`](backend/app/nlp/training_data.csv)
  (header: `text,intent`), delete `_intent_model.joblib`, restart — the
  classifier retrains on boot.
- **Add product SKUs**: edit `PRODUCT_CATALOG` in
  [`backend/app/nlp/entities.py`](backend/app/nlp/entities.py).
- **Add intents**: extend `INTENTS` in
  [`backend/app/nlp/training_data.py`](backend/app/nlp/training_data.py),
  add labeled rows to the CSV, add a routing rule in
  [`routing.py`](backend/app/nlp/routing.py), an action template in
  [`response.py`](backend/app/nlp/response.py), and a baseline in
  [`urgency.py`](backend/app/nlp/urgency.py).
- **Upgrade to embeddings**: swap `TfidfVectorizer` in
  [`semantic_search.py`](backend/app/nlp/semantic_search.py) for sentence
  embeddings (sentence-transformers) and replace the classifier in
  [`classifier.py`](backend/app/nlp/classifier.py) similarly.

## Authentication

ResolveAI uses [Supabase Auth](https://supabase.com/docs/guides/auth) — see
[SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the full setup walkthrough.

- Sign-up captures the user's chosen role (`customer` / `agent` / `manager`
  / `admin`) into Supabase `user_metadata`.
- The frontend keeps the session in `localStorage` (Supabase default) and
  attaches the bearer token to every `/api/*` call.
- The backend verifies the JWT against `SUPABASE_JWT_SECRET` (HS256 legacy)
  or against the project's JWKS endpoint (ES256/RS256 new) — algorithm is
  picked from the token header automatically.
- Per-role guards: only customers may submit tickets and chat from the
  portal, only staff (agent / manager / admin) may read/reply/send/assign
  /route tickets, only managers+ see manager analytics + shifts, only
  admins see admin analytics.
- For trusted role elevation, set `app_metadata.role` from the Supabase
  dashboard — the backend honors it over the user-editable `user_metadata`.
- Dev escape hatch: set `SUPABASE_AUTH_DISABLED=1` in `backend/.env` to
  bypass JWT verification (treats every request as a synthetic admin).

## Optional integrations

### Live LLM replies (Groq)
Set `GROQ_API_KEY` in `backend/.env` to enable real LLM-drafted replies.
The free tier is enough for development. The pipeline calls Groq first and
falls back to the deterministic template if the call fails or the key is
unset. Override `GROQ_MODEL` (default `llama-3.3-70b-versatile`) and
`GROQ_TIMEOUT` (default 15 s) as needed.

### Routing emails (SMTP)
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
and `SMTP_USE_TLS` in `backend/.env` to send real emails when an agent
routes a ticket to a department. Without SMTP configured, routes are
recorded as `simulated` so the UI flow still works in dev.

Per-department contact emails can be overridden with `DEPT_EMAIL_FINANCE`,
`DEPT_EMAIL_LOGISTICS`, `DEPT_EMAIL_SUPPORT`, `DEPT_EMAIL_FRAUD`, etc.
(prefix `DEPT_EMAIL_` + first word of the department, upper-cased).

## Known scope cuts

- **System Admin / Developer view** (project.md §3.5) — not built. Would be
  a fifth screen showing model metrics (already persisted in
  `model_metrics` table) + system health.
- **Real email/chat ingest** — channels are recorded but messages only
  enter the system via `POST /api/tickets/process` and the in-app chat
  endpoints. There is no IMAP/Gmail/SES inbound bridge.
- **Manager "Coaching", "Macro performance", "Complaint trends"** tabs are
  placeholders ("coming soon"). KPIs/queue/agents/shifts are real.
