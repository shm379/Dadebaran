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
import { listPlans, getStatus, checkout, cancel, checkQuota, incrementUsage } from './billing.mjs'

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

app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.post('/api/auth/logout', logout)
app.get('/api/auth/me', me)

// ---- Models ----
app.get('/api/models', requireAuth, async (_req, res) => {
  try {
    res.json({ models: await listModels() })
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

// ---- Billing / subscription ----
app.get('/api/plans', (_req, res) => res.json({ plans: listPlans() }))

app.get('/api/subscription', requireAuth, async (req, res) => {
  try {
    res.json(await getStatus(req.user.id))
  } catch (err) {
    res.status(503).json({ error: String(err) })
  }
})

app.post('/api/subscription/checkout', requireAuth, async (req, res) => {
  try {
    const { status, body } = await checkout(req.user.id, (req.body && req.body.plan) || '')
    res.status(status).json(body)
  } catch (err) {
    res.status(503).json({ error: String(err) })
  }
})

app.post('/api/subscription/cancel', requireAuth, async (req, res) => {
  try {
    const { status, body } = await cancel(req.user.id)
    res.status(status).json(body)
  } catch (err) {
    res.status(503).json({ error: String(err) })
  }
})

// ---- Completion (usage-gated) ----
app.post('/api/complete', requireAuth, async (req, res) => {
  try {
    const quota = await checkQuota(req.user.id)
    if (!quota.allowed) {
      return res.status(402).json({
        error: 'quota_exceeded',
        message: 'سقفِ پیام‌های امروزِ پلنِ رایگان پر شده. برای ادامه، اشتراک تهیه کن.',
        usage: quota,
      })
    }
    const { status, body } = await handleComplete(req.body)
    if (status === 200) {
      incrementUsage(req.user.id).catch((e) => console.warn('[usage] increment failed:', e.message))
    }
    res.status(status).json(body)
  } catch (err) {
    res.status(500).json({ error: String(err) })
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
