// Developer API keys. The full key is shown once at creation; only a SHA-256
// hash is stored. Keys authenticate programmatic requests via
// `Authorization: Bearer mrc_...` (see requireAuth in auth.mjs).
import crypto from 'node:crypto'
import { pool } from './db.mjs'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function hashKey(k) {
  return crypto.createHash('sha256').update(k).digest('hex')
}

function summary(row) {
  return {
    id: String(row.id),
    name: row.name || '',
    prefix: row.prefix,
    revoked: row.revoked,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }
}

export async function listKeys(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, prefix, revoked, last_used_at, created_at FROM api_keys WHERE user_id = $1 ORDER BY id DESC`,
      [req.user.id],
    )
    res.json({ keys: rows.map(summary) })
  } catch (err) {
    console.error('[keys] list error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function createKey(req, res) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) || null : null
  const secret = 'mrc_' + crypto.randomBytes(24).toString('hex') // 48 hex chars
  const prefix = secret.slice(0, 12)
  try {
    const { rows } = await pool.query(
      `INSERT INTO api_keys (user_id, name, prefix, key_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, prefix, revoked, last_used_at, created_at`,
      [req.user.id, name, prefix, hashKey(secret)],
    )
    // Full key returned ONCE — never retrievable again.
    res.status(201).json({ key: secret, meta: summary(rows[0]) })
  } catch (err) {
    console.error('[keys] create error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function revokeKey(req, res) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE api_keys SET revoked = true WHERE id = $1 AND user_id = $2 AND revoked = false`,
      [req.params.id, req.user.id],
    )
    if (!rowCount) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[keys] revoke error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

// Resolve a bearer API key to a user (for requireAuth). Returns the same shape
// as the cookie path, including isAdmin.
export async function userFromApiKey(fullKey) {
  if (!fullKey || !fullKey.startsWith('mrc_')) return null
  const { rows } = await pool.query(
    `SELECT k.id AS key_id, u.id, u.email, u.phone, u.name, u.is_admin
       FROM api_keys k JOIN users u ON u.id = k.user_id
      WHERE k.key_hash = $1 AND k.revoked = false`,
    [hashKey(fullKey)],
  )
  const row = rows[0]
  if (!row) return null
  // Throttle last_used bookkeeping (fire-and-forget).
  pool
    .query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '60 seconds')`, [row.key_id])
    .catch(() => {})
  return {
    id: String(row.id),
    email: row.email,
    phone: row.phone,
    name: row.name,
    isAdmin: row.is_admin === true || (row.email && ADMIN_EMAILS.includes(String(row.email).toLowerCase())),
  }
}

export { ADMIN_EMAILS }
