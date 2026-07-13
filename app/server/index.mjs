// App server: serves the built SPA (in production) and the JSON API — auth
// (email/phone register + login) and the model proxy (POST /api/complete,
// auth-gated, routed internally to NabuGate). Used both by `npm start` and
// inside the Docker image. During `vite dev` the frontend runs separately and
// proxies /api here (see vite.config.ts).
import express from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb, ping } from './db.mjs'
import { register, login, logout, me, requireAuth } from './auth.mjs'
import { handleComplete } from './complete.mjs'
import { listModels } from './models.mjs'
import { listPlans, getStatus, checkout, cancel, consumeQuota, refundQuota } from './billing.mjs'
import { rateLimit } from './ratelimit.mjs'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const INDEX_HTML = join(DIST, 'index.html')
const PORT = Number(process.env.PORT || 3000)

const app = express()
app.set('trust proxy', 1) // behind Coolify / Traefik so secure cookies work
app.use(express.json({ limit: '12mb' }))

// ---- API ----
app.get('/api/health', async (_req, res) => {
  try {
    await ping()
    res.json({ ok: true, db: 'up' })
  } catch {
    res.status(503).json({ ok: false, db: 'down' })
  }
})

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'تلاش‌های زیاد. چند دقیقه بعد دوباره امتحان کن.',
})
app.post('/api/auth/register', authLimiter, register)
app.post('/api/auth/login', authLimiter, login)
app.post('/api/auth/logout', logout)
app.get('/api/auth/me', me)

// Log the real error server-side, return a generic message to the client.
function fail(res, status, err, code = 'server') {
  console.error('[api] error:', err && err.message ? err.message : err)
  res.status(status).json({ error: code })
}

// ---- Models ----
app.get('/api/models', requireAuth, async (_req, res) => {
  try {
    res.json({ models: await listModels() })
  } catch (err) {
    fail(res, 502, err, 'models_unavailable')
  }
})

// ---- Billing / subscription ----
app.get('/api/plans', (_req, res) => res.json({ plans: listPlans() }))

app.get('/api/subscription', requireAuth, async (req, res) => {
  try {
    res.json(await getStatus(req.user.id))
  } catch (err) {
    fail(res, 503, err)
  }
})

app.post('/api/subscription/checkout', requireAuth, async (req, res) => {
  try {
    const { status, body } = await checkout(req.user.id, (req.body && req.body.plan) || '')
    res.status(status).json(body)
  } catch (err) {
    fail(res, 503, err)
  }
})

app.post('/api/subscription/cancel', requireAuth, async (req, res) => {
  try {
    const { status, body } = await cancel(req.user.id)
    res.status(status).json(body)
  } catch (err) {
    fail(res, 503, err)
  }
})

// ---- Completion (usage-gated) ----
app.post('/api/complete', requireAuth, async (req, res) => {
  let reserved = false
  try {
    // Reserve a quota slot atomically BEFORE the (slow) model call.
    const quota = await consumeQuota(req.user.id)
    if (!quota.allowed) {
      return res.status(402).json({
        error: 'quota_exceeded',
        message: 'سقفِ پیام‌های امروزِ پلنِ رایگان پر شده. برای ادامه، اشتراک تهیه کن.',
        usage: quota,
      })
    }
    reserved = quota.limit != null
    const { status, body } = await handleComplete(req.body)
    if (status !== 200 && reserved) {
      // The model call failed — don't bill the reserved slot.
      await refundQuota(req.user.id).catch((e) => console.warn('[usage] refund failed:', e.message))
    }
    res.status(status).json(body)
  } catch (err) {
    if (reserved) await refundQuota(req.user.id).catch(() => {})
    fail(res, 500, err)
  }
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }))

// ---- Static SPA (production) ----
if (existsSync(INDEX_HTML)) {
  app.use(express.static(DIST))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.sendFile(INDEX_HTML)
  })
} else {
  console.warn('[server] dist/ not found — API only (run `npm run build` for the SPA)')
}

async function start() {
  try {
    await initDb()
  } catch (err) {
    console.error('[server] database unavailable at startup:', err.message)
    // Keep serving so /api/health reports the outage instead of crash-looping.
  }
  app.listen(PORT, () => console.log(`MR.CHATGPT assistants listening on :${PORT}`))
}

start()
