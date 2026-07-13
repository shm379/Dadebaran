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
- **Subscriptions** — free / pro / business plans, per-day usage limits on the
  free plan, an in-app plans dialog. Provider-agnostic checkout (manual by
  default; ready to plug in Zarinpal/Stripe).
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

## Environment

See `.env.example`. Key vars: `JWT_SECRET` (required), `DATABASE_URL` or
`POSTGRES_*`, `COOKIE_SECURE`, `NABUGATE_URL` / `NABUGATE_API_KEY` /
`NABUGATE_MODEL`, `ANTHROPIC_API_KEY` (fallback), `BILLING_PROVIDER`.
