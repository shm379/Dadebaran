// Per-user conversation history. Messages are stored as a JSONB array on the
// conversation row; image data URLs are stripped before storage so the DB stays
// lean (history keeps the text, not the base64 pixels).
import { pool } from './db.mjs'

const MAX_MESSAGES = 500

function slimMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages.slice(-MAX_MESSAGES).map((m) => {
    const c = { ...m }
    if (c.image) c.image = null // don't persist base64 images
    return c
  })
}

function deriveTitle(messages, given) {
  if (typeof given === 'string' && given.trim()) return given.trim().slice(0, 100)
  const first = (Array.isArray(messages) ? messages : []).find((m) => m.role === 'user' && m.text && m.text.trim())
  return (first ? first.text.trim() : 'گفت‌وگو').slice(0, 100)
}

function summary(row) {
  return {
    id: String(row.id),
    botId: row.bot_id,
    title: row.title || 'گفت‌وگو',
    updatedAt: row.updated_at,
    messageCount: Number(row.message_count ?? 0),
  }
}

export async function listConversations(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, bot_id, title, updated_at, jsonb_array_length(messages) AS message_count
         FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200`,
      [req.user.id],
    )
    res.json({ conversations: rows.map(summary) })
  } catch (err) {
    console.error('[conv] list error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function getConversation(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, bot_id, title, messages, updated_at FROM conversations WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    const r = rows[0]
    res.json({ conversation: { id: String(r.id), botId: r.bot_id, title: r.title, messages: r.messages, updatedAt: r.updated_at } })
  } catch (err) {
    console.error('[conv] get error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function createConversation(req, res) {
  const body = req.body || {}
  const botId = typeof body.botId === 'string' ? body.botId : ''
  if (!botId) return res.status(400).json({ error: 'bad_bot' })
  const messages = slimMessages(body.messages)
  const title = deriveTitle(messages, body.title)
  try {
    const { rows } = await pool.query(
      `INSERT INTO conversations (user_id, bot_id, title, messages)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id, updated_at`,
      [req.user.id, botId, title, JSON.stringify(messages)],
    )
    res.status(201).json({ id: String(rows[0].id), title, updatedAt: rows[0].updated_at })
  } catch (err) {
    console.error('[conv] create error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function updateConversation(req, res) {
  const body = req.body || {}
  const hasMessages = 'messages' in body
  const messages = hasMessages ? slimMessages(body.messages) : null
  const title = deriveTitle(messages || [], body.title)
  try {
    const { rows } = await pool.query(
      `UPDATE conversations
          SET title = COALESCE($3, title),
              messages = COALESCE($4::jsonb, messages),
              updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, updated_at`,
      [req.params.id, req.user.id, title, hasMessages ? JSON.stringify(messages) : null],
    )
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true, updatedAt: rows[0].updated_at })
  } catch (err) {
    console.error('[conv] update error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function deleteConversation(req, res) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user.id,
    ])
    if (!rowCount) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[conv] delete error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}
