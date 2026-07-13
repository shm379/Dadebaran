// Email / phone registration + login, backed by a JWT stored in an httpOnly
// cookie. Passwords are hashed with bcrypt. All user-facing messages are in
// Persian so the RTL frontend can show them verbatim.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from './db.mjs'

const COOKIE_NAME = 'mrc_token'
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30 // 30 days
const SALT_ROUNDS = 10
// Compared against when a login identifier doesn't exist, so response time
// doesn't leak whether an account exists (constant-time-ish).
const DUMMY_HASH = bcrypt.hashSync('mrc-nonexistent-account-placeholder', SALT_ROUNDS)

// Minimal, dependency-free cookie serialize/parse (RFC 6265 subset we need).
function serializeCookie(name, value, opts = {}) {
  let str = `${name}=${encodeURIComponent(value)}`
  if (opts.maxAge != null) str += `; Max-Age=${Math.floor(opts.maxAge)}`
  if (opts.path) str += `; Path=${opts.path}`
  if (opts.httpOnly) str += '; HttpOnly'
  if (opts.sameSite) str += `; SameSite=${opts.sameSite[0].toUpperCase()}${opts.sameSite.slice(1)}`
  if (opts.secure) str += '; Secure'
  return str
}
function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k && !(k in out)) {
      try {
        out[k] = decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        out[k] = part.slice(i + 1).trim()
      }
    }
  }
  return out
}

function jwtSecret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET is missing or too short (need >= 16 chars)')
  }
  return s
}

function cookieSecure() {
  if (process.env.COOKIE_SECURE != null) return process.env.COOKIE_SECURE === 'true'
  return process.env.NODE_ENV === 'production'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Accept an optional leading + and 7–15 digits (spaces/dashes stripped first).
const PHONE_RE = /^\+?\d{7,15}$/

function normEmail(v) {
  return typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null
}
function normPhone(v) {
  if (typeof v !== 'string' || !v.trim()) return null
  return v.replace(/[\s-]/g, '')
}

function publicUser(row) {
  return { id: String(row.id), email: row.email, phone: row.phone, name: row.name }
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, jwtSecret(), { expiresIn: TOKEN_TTL_SEC })
  res.setHeader(
    'Set-Cookie',
    serializeCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure(),
      path: '/',
      maxAge: TOKEN_TTL_SEC,
    }),
  )
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure(),
      path: '/',
      maxAge: 0,
    }),
  )
}

function readToken(req) {
  const header = req.headers.cookie
  if (!header) return null
  const parsed = parseCookies(header)
  return parsed[COOKIE_NAME] || null
}

export async function register(req, res) {
  const body = req.body || {}
  const email = normEmail(body.email)
  const phone = normPhone(body.phone)
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) || null : null
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email && !phone) {
    return res.status(400).json({ error: 'identifier_required', message: 'ایمیل یا شماره تلفن را وارد کن.' })
  }
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'bad_email', message: 'ایمیل معتبر نیست.' })
  }
  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'bad_phone', message: 'شماره تلفن معتبر نیست.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'weak_password', message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, phone, name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, phone, name`,
      [email, phone, name, hash],
    )
    const user = rows[0]
    setAuthCookie(res, user)
    return res.status(201).json({ user: publicUser(user) })
  } catch (err) {
    if (err && err.code === '23505') {
      // unique_violation on email or phone
      const which = String(err.constraint || '').includes('phone') ? 'شماره تلفن' : 'ایمیل'
      return res.status(409).json({ error: 'exists', message: `این ${which} قبلاً ثبت شده. وارد شو.` })
    }
    console.error('[auth] register error:', err.message)
    return res.status(503).json({ error: 'server', message: 'ثبت‌نام موقتاً ممکن نیست. کمی بعد دوباره امتحان کن.' })
  }
}

export async function login(req, res) {
  const body = req.body || {}
  const raw = typeof body.identifier === 'string' ? body.identifier.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!raw || !password) {
    return res.status(400).json({ error: 'missing', message: 'ایمیل/شماره و رمز عبور را وارد کن.' })
  }
  const asEmail = normEmail(raw)
  const asPhone = normPhone(raw)
  try {
    const { rows } = await pool.query(
      `SELECT id, email, phone, name, password_hash
         FROM users
        WHERE (email IS NOT NULL AND lower(email) = $1) OR (phone IS NOT NULL AND phone = $2)
        LIMIT 1`,
      [asEmail, asPhone],
    )
    const row = rows[0]
    // Always run a compare (dummy hash when no user) to avoid a timing oracle.
    const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH)
    if (!row || !ok) {
      return res.status(401).json({ error: 'bad_credentials', message: 'ایمیل/شماره یا رمز عبور اشتباه است.' })
    }
    setAuthCookie(res, row)
    return res.json({ user: publicUser(row) })
  } catch (err) {
    console.error('[auth] login error:', err.message)
    return res.status(503).json({ error: 'server', message: 'ورود موقتاً ممکن نیست. کمی بعد دوباره امتحان کن.' })
  }
}

export function logout(_req, res) {
  clearAuthCookie(res)
  return res.json({ ok: true })
}

async function userFromReq(req) {
  const token = readToken(req)
  if (!token) return null
  let payload
  try {
    payload = jwt.verify(token, jwtSecret())
  } catch {
    return null
  }
  const { rows } = await pool.query('SELECT id, email, phone, name FROM users WHERE id = $1', [payload.sub])
  return rows[0] ? publicUser(rows[0]) : null
}

export async function me(req, res) {
  try {
    // A probe for "am I logged in?" — return 200 with user:null when not, so an
    // anonymous page load isn't a console error on the client.
    const user = await userFromReq(req)
    return res.json({ user: user || null })
  } catch (err) {
    console.error('[auth] me error:', err.message)
    return res.status(503).json({ error: 'server' })
  }
}

// Express middleware: attaches req.user or replies 401.
export async function requireAuth(req, res, next) {
  try {
    const user = await userFromReq(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated', message: 'ابتدا وارد شو.' })
    req.user = user
    next()
  } catch (err) {
    console.error('[auth] requireAuth error:', err.message)
    return res.status(503).json({ error: 'server' })
  }
}
