# دستیارهای MR.CHATGPT — Persian assistants app

A production React implementation of the **پرامپت‌نویس فارسی** design exported from
Claude Design (see `../project` and `../chats`). It's a single-screen RTL Persian
multi-assistant chat app in the MR.CHATGPT brand.

## Features

- **5 assistants** in two sidebar categories, each with its own hero, examples,
  output settings, quick-refine chips, and its own saved conversation:
  - **ساختن و نوشتن** — پرامپت‌نویس فارسی · محاوره به رسمی · کوچ هوک و کپشن
  - **یاد گرفتن** — تمرین انگلیسی · خلاصه‌ساز درسی
- **Structured results** — each answer is a copyable "prompt card" with tips and
  refine chips (کوتاه‌ترش کن / حرفه‌ای‌ترش کن / …).
- **Image & video upload** — images are downscaled to ≤1024 px; a video's middle
  frame is extracted client-side. Both are sent to the model as vision blocks.
- **Voice** — dictation (speech→text) in the composer, plus a full voice-chat
  overlay with a live 32-bar microphone visualizer and spoken replies (TTS).
- **Scheduled tasks** — pick an assistant + prompt + repeat + time; tasks run on
  a timer while the app is open and store their results.
- Everything persists to `localStorage`.

## Running

```bash
npm install
npm run dev        # http://localhost:5173  (Vite dev server + /api/complete proxy)
```

Production:

```bash
npm run build      # type-checks and bundles to dist/
npm start          # node server.mjs — serves dist/ + the /api/complete proxy
```

## Live model calls

The prototype relied on the design runtime's `window.claude.complete`. Here that
call is proxied through **`POST /api/complete`** to the
[Anthropic Messages API](https://docs.anthropic.com/en/api/messages), so the key
stays server-side. Configure it with environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...                  # required for real answers
export ANTHROPIC_MODEL=claude-haiku-4-5-20251001     # optional override
```

Without a key the endpoint returns `503` and the UI shows the same friendly
Persian fallback message the prototype used — so the app runs and is fully
navigable before any key is wired up.

The proxy is implemented once in `server/anthropic.mjs` and reused by both the
Vite dev middleware (`vite.config.ts`) and the standalone production server
(`server.mjs`).

## Structure

| File | Role |
| --- | --- |
| `src/App.tsx` | Main component — a faithful port of the prototype's `DCLogic` class |
| `src/config.ts` | Assistant catalog (`cfg`, `GROUPS`, `ORDER`, default settings) |
| `src/prompts.ts` | Per-assistant prompt construction + JSON response parsing |
| `src/api.ts` | Client for the model call (`/api/complete`) |
| `src/css.ts` / `src/Hover.tsx` | Inline-style + `:hover` helpers matching the design 1:1 |
| `server/anthropic.mjs` | Shared Anthropic proxy handler |
