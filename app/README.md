# دستیارهای MR.CHATGPT

A production React + TypeScript app implementing the **پرامپت‌نویس فارسی** design
(exported from Claude Design — see `../project` and `../chats`) as a small SaaS:
five RTL Persian AI assistants, user accounts, a model gateway, and subscriptions.

## Features

- **Five assistants** in two categories, each with its own hero, examples,
  output settings, quick-refine chips and saved conversation:
  ساختن و نوشتن (پرامپت‌نویس · محاوره به رسمی · کوچ هوک و کپشن) و
  یاد گرفتن (تمرین انگلیسی · خلاصه‌ساز درسی).
- **Accounts** — register / log in with **email or phone**, session in an
  httpOnly cookie (JWT), bcrypt password hashing.
- **Model gateway** — completions are proxied server-side to **NabuGate** (the
  internal OpenAI-compatible gateway). The model list is fetched from it and
  shown in a picker.
- **Streaming answers** — replies stream in over SSE (`POST /api/complete/stream`)
  and render as they're written, with a **stop** button that keeps whatever
  already arrived. Gateways that don't implement `stream: true` are detected and
  fall back to the buffered call automatically, so streaming can't break chat.
- **Subscriptions** — free / pro / business plans, per-day usage limits on the
  free plan, an in-app plans dialog, and **Zibal** payment checkout
  (`BILLING_PROVIDER=zibal`) with server-side verification (or `manual` demo mode).
- **Rich input** — image & video upload (sent as vision blocks), voice dictation,
  a voice-conversation overlay, and scheduled tasks.

## Architecture

```
src/
  App.tsx                 composition root (providers + layout + overlays)
  AppRoot.tsx             auth gate (loading / auth screen / app)
  state/                  ChatProvider, TasksProvider, ToastProvider
  hooks/                  useMediaAttach, useDictation, useVoice
  components/             Header, Sidebar, ChatArea, Composer, ModelPicker, …
    ui/                   HoverButton, icons
    overlays/             Tasks, Voice, Plans
    auth/                 AuthScreen
  api.ts                  backend client (auth · models · billing · complete)
  config.ts · prompts.ts  assistant catalog + prompt building
server/
  index.mjs               Express app (SPA + API)
  db.mjs                  Postgres pool + schema
  auth.mjs                register / login / me / logout + JWT middleware
  complete.mjs            NabuGate (OpenAI) proxy, Anthropic fallback
  models.mjs              GET /v1/models proxy + cache
  plans.mjs · billing.mjs plans, subscriptions, usage gating
```

State lives in React context providers; components are presentational. The
server is dependency-light (express, pg, bcryptjs, jsonwebtoken).

## Run locally

```bash
npm install
cp .env.example .env      # set JWT_SECRET, DATABASE_URL/POSTGRES_*, NABUGATE_URL
npm run dev               # web on :5173 (proxies /api) + API on :3000
```

You need a Postgres reachable via `DATABASE_URL` (or the `POSTGRES_*` vars).
Without `NABUGATE_URL`/`ANTHROPIC_API_KEY` the app runs and is fully navigable;
completions show the Persian preview message.

Production (single container process):

```bash
npm run build && npm start   # server serves dist/ + API on :3000
```

## Deploy on Coolify (Docker Compose)

`docker-compose.yml` brings up the **app** + **Postgres**. In Coolify create a
*Docker Compose* resource pointing at this file and set the env vars
(`JWT_SECRET`, `POSTGRES_PASSWORD`, `NABUGATE_URL`, `NABUGATE_API_KEY`, …) in the
UI. Coolify maps your domain to the app container's port 3000.

```bash
# or locally:
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
```

To reach a NabuGate running as a separate Coolify resource, set
`NABUGATE_URL=http://<nabugate-service>:8080` and attach this stack to that
service's network (see the commented `networks` block in the compose file).

## API

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` · `login` · `logout` | – | accounts (email/phone) |
| `GET /api/auth/me` | cookie | current user (or `{user:null}`) |
| `GET /api/models` | ✓ | model list from NabuGate |
| `GET /api/plans` | – | subscription plans |
| `GET /api/subscription` · `POST .../checkout` · `.../cancel` | ✓ | billing |
| `POST /api/complete` | ✓ | model completion (usage-gated) |
| `GET /api/health` | – | liveness + DB check |

## Frontend + backend on separate origins

By default the server serves the SPA and the API together, so the client calls
relative `/api/...` paths and cookies "just work". To host the built **design**
on its own origin (static host / separate Coolify resource) and point it at this
API, set three things:

- `VITE_API_BASE_URL` (build time) — the API's base URL, e.g. `https://api.example.com`.
  The client prefixes every request with it.
- `CORS_ORIGIN` (backend) — allowlist of frontend origins, e.g. `https://app.example.com`
  (comma-separated, or `*`). The server echoes the origin and allows credentials.
- `COOKIE_SAMESITE=none` (backend) — so the session cookie is sent cross-origin
  (this forces `Secure`, i.e. HTTPS).

All client calls already send `credentials: 'include'`, so the cookie session
works cross-origin once the above are set.

## Access control, API keys, admin

- **Plan-gated models** — the free plan may use only `FREE_MODEL_IDS` (default
  `nabu-fast`); other models need a paid plan. The picker shows locked models and
  the server enforces it on `/api/complete` (403 if locked).
- **Developer API keys** — users issue keys in Settings (shown once). Programs
  authenticate with `Authorization: Bearer mrc_...` on `/api/complete` (and other
  protected routes). Keys are stored hashed and can be revoked.
- **Admin** — set `ADMIN_EMAILS` (comma-separated) to grant admin, or flip
  `users.is_admin`. Admins get a panel (header shield) with stats and user
  management: search users, change a user's plan (no payment), toggle admin, and
  delete users. Endpoints live under `/api/admin/*` behind `requireAdmin`.

## Connect NabuGate (real answers)

Set these on the backend (Coolify env or `.env`) and completions go to your
gateway instead of the preview message:

```
NABUGATE_URL=http://<host>:8080      # or https://nabugate.yourdomain — address + port
NABUGATE_API_KEY=nabu_...            # a valid Nabu API key (Bearer)
NABUGATE_MODEL=nabu-fast             # a model alias the gateway exposes
```

If the app and NabuGate both run in Coolify, use NabuGate's internal address
(e.g. `http://nabugate:8080`) and put both on the same Docker network (see the
compose `networks` note). The model picker is populated from `GET /v1/models`.

## Payments (Zibal)

```
BILLING_PROVIDER=zibal
ZIBAL_MERCHANT=<your-merchant-id>    # "zibal" is the sandbox merchant for testing
APP_BASE_URL=https://gpt.example.com # public URL of THIS app (for the callback)
```

Flow: choosing a paid plan calls `POST /api/subscription/checkout`, which asks
Zibal for a payment and returns a `checkoutUrl`; the browser is redirected there.
After paying, Zibal returns to `GET /api/billing/zibal/callback`, which
**verifies the payment server-side** and activates the subscription, then bounces
back to the app with `?billing=success`. Plan prices are in Toman and converted
to Rial for Zibal.

## Environment

See `.env.example`. Key vars: `JWT_SECRET` (required), `DATABASE_URL` or
`POSTGRES_*`, `COOKIE_SECURE`, `NABUGATE_URL` / `NABUGATE_API_KEY` /
`NABUGATE_MODEL`, `ANTHROPIC_API_KEY` (fallback), `BILLING_PROVIDER`,
`VITE_API_BASE_URL` / `CORS_ORIGIN` / `COOKIE_SAMESITE` (cross-origin).
