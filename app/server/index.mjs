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
import { register, login, logout, me, requireAuth, requireAdmin, updateProfile, changePassword } from './auth.mjs'
import { handleComplete } from './complete.mjs'
import { listModels } from './models.mjs'
import { currentPlanCode, listPlans, getStatus, checkout, cancel, reconcile, consumeQuota, refundQuota, verifyAndActivateZibal } from './billing.mjs'
import { modelAllowedForPlan, requiredPlanForModel } from './plans.mjs'
import { listKeys, createKey, revokeKey } from './apikeys.mjs'
import { adminStats, adminUsers, adminUpdateUser, adminDeleteUser } from './admin.mjs'
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
} from './conversations.mjs'
import { rateLimit } from './ratelimit.mjs'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const INDEX_HTML = join(DIST, 'index.html')
const PORT = Number(process.env.PORT || 3000)

const app = express()
app.set('trust proxy', 1) // behind Coolify / Traefik so secure cookies work

// CORS — only needed when the frontend is served from a different origin than
// this API. Set CORS_ORIGIN to a comma-separated allowlist (or "*"). Credentials
// are allowed so the session cookie is sent; the allowed origin is echoed back
// (never "*" with credentials), and the frontend must send credentials + the
// cookie must be COOKIE_SAMESITE=none (Secure) to cross origins.
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (CORS_ORIGINS.length) {
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin && (CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Max-Age', '600')
      if (req.method === 'OPTIONS') return res.status(204).end()
    } else if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }
    next()
  })
}

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
app.patch('/api/auth/profile', requireAuth, updateProfile)
app.post('/api/auth/password', requireAuth, changePassword)

// Log the real error server-side, return a generic message to the client.
function fail(res, status, err, code = 'server') {
  console.error('[api] error:', err && err.message ? err.message : err)
  res.status(status).json({ error: code })
}

// ---- Conversation history ----
app.get('/api/conversations', requireAuth, listConversations)
app.post('/api/conversations', requireAuth, createConversation)
app.get('/api/conversations/:id', requireAuth, getConversation)
app.patch('/api/conversations/:id', requireAuth, updateConversation)
app.delete('/api/conversations/:id', requireAuth, deleteConversation)

// ---- Models (annotated with plan access) ----
app.get('/api/models', requireAuth, async (req, res) => {
  try {
    const [list, planCode] = await Promise.all([listModels(), currentPlanCode(req.user.id)])
    const models = list.map((m) => {
      const allowed = modelAllowedForPlan(planCode, m.id)
      return { ...m, allowed, requiredPlan: allowed ? null : requiredPlanForModel(m.id) }
    })
    res.json({ models, plan: planCode })
  } catch (err) {
    fail(res, 502, err, 'models_unavailable')
  }
})

// ---- Developer API keys ----
app.get('/api/keys', requireAuth, listKeys)
app.post('/api/keys', requireAuth, createKey)
app.delete('/api/keys/:id', requireAuth, revokeKey)

// ---- Admin ----
app.get('/api/admin/stats', requireAuth, requireAdmin, adminStats)
app.get('/api/admin/users', requireAuth, requireAdmin, adminUsers)
app.patch('/api/admin/users/:id', requireAuth, requireAdmin, adminUpdateUser)
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, adminDeleteUser)

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
    const { status, body } = await checkout(req.user.id, (req.body && req.body.plan) || '', {
      mobile: req.user.phone,
    })
    res.status(status).json(body)
  } catch (err) {
    fail(res, 503, err)
  }
})

app.post('/api/subscription/reconcile', requireAuth, async (req, res) => {
  try {
    const { status, body } = await reconcile(req.user.id)
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

// Zibal payment callback (public — the user's browser is redirected here by the
// gateway). We verify server-side before activating, then bounce back to the app.
app.get('/api/billing/zibal/callback', async (req, res) => {
  const base = (process.env.APP_BASE_URL || '').replace(/\/+$/, '')
  let ok = false
  try {
    const result = await verifyAndActivateZibal(String(req.query.trackId || ''))
    ok = result.ok
  } catch (err) {
    console.error('[zibal] callback error:', err && err.message)
  }
  res.redirect(`${base || ''}/?billing=${ok ? 'success' : 'failed'}`)
})

// ---- Completion (usage-gated) ----
app.post('/api/complete', requireAuth, async (req, res) => {
  let reserved = false
  try {
    // Enforce plan-based model access before doing any work.
    const requestedModel = req.body && typeof req.body.model === 'string' ? req.body.model : ''
    if (requestedModel) {
      const planCode = await currentPlanCode(req.user.id)
      if (!modelAllowedForPlan(planCode, requestedModel)) {
        return res.status(403).json({
          error: 'model_locked',
          message: 'این مدل در پلنِ فعلیت در دسترس نیست. برای دسترسی، اشتراکت رو ارتقا بده.',
          requiredPlan: requiredPlanForModel(requestedModel),
        })
      }
    }
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
