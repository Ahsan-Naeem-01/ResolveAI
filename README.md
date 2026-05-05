# ResolveAI — Smart Customer Support Intelligence

End-to-end implementation of the platform spec'd in [`project.md`](project.md).
NLP pipeline classifies customer queries, extracts entities, retrieves similar
resolved cases, drafts replies, and routes tickets — backed by a real SQLite
database, a FastAPI backend, and a Vite + React frontend.

## Architecture

```
┌─────────────────────────┐     /api/*      ┌──────────────────────────┐
│  Vite + React           │◄───────────────►│  FastAPI  (port 8000)    │
│  (port 5173 in dev)     │                 │  ├── routers/            │
│  ├── PortalLayout       │                 │  │   ├── tickets.py      │
│  │   └── CustomerScreen │                 │  │   ├── analytics.py    │
│  └── AppShell           │                 │  │   ├── agents.py       │
│      ├── AgentScreen    │                 │  │   └── faq.py          │
│      ├── ManagerScreen  │                 │  ├── nlp/                │
│      └── AdminScreen    │                 │  │   ├── pipeline.py     │
└─────────────────────────┘                 │  │   ├── classifier.py   │
                                            │  │   ├── entities.py     │
                                            │  │   ├── keywords.py     │
                                            │  │   ├── sentiment.py    │
                                            │  │   ├── urgency.py      │
                                            │  │   ├── semantic_search │
                                            │  │   ├── response.py     │
                                            │  │   └── routing.py      │
                                            │  └── models.py (SQLAlchemy)
                                            │              ▼            │
                                            │       resolveai.db        │
                                            └──────────────────────────┘
```

## Stack

- **Backend**: FastAPI 0.115, SQLAlchemy 2, SQLite, scikit-learn 1.5
- **NLP**: TF-IDF + Logistic Regression intent classifier (~115 labeled
  examples · 7 intents), regex+catalog entity extraction, TF-IDF cosine
  similarity for semantic search, lexicon-based sentiment, rule + sentiment-
  driven urgency, template-driven reply generation
- **Frontend**: React 18, Vite 5, code-split screens, ErrorBoundary, skeleton
  loaders, slate + indigo design system

## Quick start (dev)

Two terminals.

**Backend** (installs deps, trains the classifier, seeds demo tickets, starts
on `:8000`):

```bash
cd backend
python -m pip install -r requirements.txt
python run.py
```

**Frontend** (Vite dev server on `:5173`, proxies `/api` → `:8000`):

```bash
cd frontend-vite
npm install
npm run dev
```

Open http://localhost:5173.

## Quick start (single process, prod-ish)

Build the frontend, then run the backend — it auto-detects
`frontend-vite/dist` and serves the SPA at `/` while exposing the API at
`/api/*`:

```bash
cd frontend-vite && npm install && npm run build && cd ..
cd backend && python -m pip install -r requirements.txt && python run.py
```

Open http://localhost:8000.

## What works

### Customer help portal
- Public-facing surface with its own layout (no sidebar)
- Free-form natural-language input with attachment + order-link affordances
- Suggestion chips for common issues
- Live AI processing animation showing all 6 NLP steps with real timings
- Structured AI result: intent + confidence, urgency, sentiment, extracted
  order/product/date entities, keywords, similar resolved cases (TF-IDF cosine),
  routed department, suggested reply

### Staff app shell (Agent / Manager / Admin)
- Persistent sidebar nav with role-specific items + active highlight
- Top header with breadcrumb + search + per-role actions
- User menu (lower-left) with **View as** role switcher and theme toggle
- Skeleton loaders during data fetch
- Error boundary catches any render failure with a recoverable UI

### Agent workspace
- Filterable inbox (All / Critical / High / Needs review) backed by
  `/api/tickets`
- Ticket detail with extracted fields, AI-drafted reply
- Editable reply textarea; **Save draft**, **Send**, **Regenerate** with
  warm/concise/formal tone variants — actually re-runs the pipeline server-side
- Similar resolved cases panel with cosine-similarity scores

### Support manager dashboard
- KPIs: open tickets, avg resolution time, AI auto-resolve %, CSAT — computed
  from the live database, with sparkline trends
- 12-bucket hourly volume chart for today
- 7-day SLA compliance per urgency level
- Per-agent performance table (handled / AHT / CSAT / AI assist rate)

### Business admin dashboard
- KPIs: total volume, cost-per-ticket (computed: $0.30 auto + $4.20 human),
  refund $ flagged, CSAT
- Donut: ticket-intent distribution
- Top product issues (aggregated from extracted product entities)
- 7×24 ticket-arrival heatmap (last 4 weeks)

### NLP pipeline (POST `/api/tickets/process`)
1. Preprocessing — tokenize, lowercase, normalize
2. **Intent classification** — TF-IDF (1-2gram) + LogisticRegression, 7 classes
3. **Entity extraction** — regex (order_id, tracking, money, email, date) +
   catalog match (10 SKUs)
4. **Keyword extraction** — TF-IDF top-k against domain corpus, with high-signal
   support-vocabulary boost
5. **Sentiment** — hand-curated polarity lexicon with negation/intensifier
   windows; produces label (Angry/Frustrated/Worried/…) and signed score
6. **Urgency** — intent priors + critical/high regex cues + sentiment ⇒
   Critical / High / Medium / Low
7. **Semantic search** — TF-IDF + cosine over training examples + resolved
   tickets, top-3 with similarity scores
8. **Solution recommendation** — intent-keyed action templates aware of
   extracted entities
9. **Reply generation** — empathy-aware template, tone variants
   (warm/concise/formal/apologetic), substitutes name + order + product
10. **Routing** — intent → Finance / Logistics / Support / Fraud-Security
11. **Aggregation** — structured JSON in the project.md §10 shape, plus
    per-step timings for the customer animation

## Frontend optimizations

- **Code splitting**: each screen is `React.lazy()`'d into its own chunk
  (initial bundle ~48 kB gzipped; per-screen chunks 1.4–3.6 kB gzipped)
- **Error boundary** wraps the app — render failures show a reload-recover UI
- **Skeleton loaders** instead of spinners for KPI rows, cards, ticket lists
- **CSS variables** for the entire palette enables instant dark mode toggle
- **Inter** font only (dropped Inter Tight) — fewer network requests
- **State persistence** to localStorage (theme + active role)

## API reference

| Method | Path | What it does |
|--------|------|--------------|
| GET    | `/api/health` | Liveness check |
| POST   | `/api/tickets/process` | Run the NLP pipeline on a query, persist a ticket |
| GET    | `/api/tickets` | List tickets (filters: `status`, `urgency`, `intent`, `q`, `limit`) |
| GET    | `/api/tickets/{code}` | Ticket detail with similar cases + replies |
| PATCH  | `/api/tickets/{code}/reply` | Update the latest draft reply |
| POST   | `/api/tickets/{code}/regenerate` | Re-run the pipeline; new draft (optional `tone`) |
| POST   | `/api/tickets/{code}/send` | Send the reply, mark resolved |
| POST   | `/api/tickets/{code}/status` | Update status / record CSAT |
| GET    | `/api/analytics/manager` | Manager dashboard payload |
| GET    | `/api/analytics/admin` | Admin dashboard payload |
| GET    | `/api/agents` | List support agents |
| GET    | `/api/agents/me/{role}` | Demo: get the canonical user for a role |
| GET    | `/api/faq` | List FAQs (filter: `intent`) |

Interactive Swagger docs at http://localhost:8000/docs.

## Project layout

```
ResolveAI/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app + static frontend mount
│   │   ├── database.py        SQLAlchemy engine + session
│   │   ├── models.py          User, Ticket, Reply, Attachment, FAQ, TrainingExample, ModelMetric
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── seed.py            Trains classifier + populates demo data
│   │   ├── nlp/               (pipeline + 9 modules)
│   │   └── routers/           (tickets, analytics, agents, faq)
│   ├── requirements.txt
│   └── run.py                 Dev entry point
├── frontend-vite/             Production React build (Vite 5)
│   ├── src/
│   │   ├── App.jsx            Role + theme state, lazy-loads screens
│   │   ├── main.jsx
│   │   ├── lib/
│   │   │   ├── api.js         Fetch wrapper
│   │   │   ├── format.js      Pill class maps
│   │   │   └── roles.js       Per-role identity + sidebar nav config
│   │   ├── components/
│   │   │   ├── AppShell.jsx     Sidebar + header (staff)
│   │   │   ├── PortalLayout.jsx Public help portal (customer)
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   ├── Icon.jsx
│   │   │   └── Spark.jsx
│   │   ├── screens/           CustomerScreen, AgentScreen, ManagerScreen, AdminScreen (code-split)
│   │   ├── styles.css         Design tokens + components (slate + indigo)
│   │   └── app-shell.css      Layout & shell-specific styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── project.md
└── README.md
```

## Database

SQLite file at `backend/resolveai.db` (created on first run). Wipe and re-seed:

```bash
rm backend/resolveai.db
python -m backend.app.seed
```

## Customizing the NLP pipeline

- **Add training examples**: edit
  [`backend/app/nlp/training_data.py`](backend/app/nlp/training_data.py),
  delete `_intent_model.joblib`, restart — the classifier retrains on boot.
- **Add product SKUs**: edit `PRODUCT_CATALOG` in
  [`backend/app/nlp/entities.py`](backend/app/nlp/entities.py).
- **Add intents**: extend `INTENTS` in `training_data.py`, add labeled examples,
  add a routing rule in [`routing.py`](backend/app/nlp/routing.py), an action
  template in [`response.py`](backend/app/nlp/response.py), and a baseline in
  [`urgency.py`](backend/app/nlp/urgency.py).
- **Upgrade to embeddings**: swap `TfidfVectorizer` in
  [`semantic_search.py`](backend/app/nlp/semantic_search.py) for sentence
  embeddings (sentence-transformers) and replace the classifier in
  [`classifier.py`](backend/app/nlp/classifier.py) similarly.

## Authentication

ResolveAI uses [Supabase Auth](https://supabase.com/docs/guides/auth) — see
[SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the full setup walkthrough.

- Sign-up captures the user's chosen role (`customer` / `agent` / `manager` /
  `admin`) into Supabase `user_metadata`.
- The frontend keeps the session in `localStorage` (Supabase default) and
  attaches the bearer token to every `/api/*` call.
- The backend verifies the JWT against `SUPABASE_JWT_SECRET` and enforces
  per-role guards: only customers may submit tickets, only staff may read /
  reply / send, only managers+ see manager analytics, only admins see admin
  analytics.
- For trusted role elevation, set `app_metadata.role` from the Supabase
  dashboard — the backend honors it over the user-editable `user_metadata`.

## Known scope cuts

- **System Admin / Developer view** (project.md §3.5) — not built. Would be
  a fifth screen showing model metrics (already persisted in `model_metrics`
  table) + system health.
- **Real LLM responses** — replies are template-composed for determinism. Swap
  `compose_reply()` in [`response.py`](backend/app/nlp/response.py) to call
  an LLM provider.
- **Real email/chat ingest** — channels are recorded but messages only enter
  via `POST /api/tickets/process`.
