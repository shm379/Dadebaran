// Admin endpoints (guarded by requireAdmin): platform stats, user management,
// plan grants, admin toggling, and deletion.
import { pool } from './db.mjs'
import { DEFAULT_PLAN } from './plans.mjs'
import { grantPlan } from './billing.mjs'

export async function adminStats(_req, res) {
  try {
    const [users, subs, msgs, keys, convs] = await Promise.all([
      pool.query('SELECT count(*) FROM users'),
      pool.query(
        `SELECT plan_code, count(*) FROM subscriptions
          WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > now())
          GROUP BY plan_code`,
      ),
      pool.query(`SELECT coalesce(sum(count), 0) AS c FROM usage_daily WHERE day = CURRENT_DATE`),
      pool.query(`SELECT count(*) FROM api_keys WHERE revoked = false`),
      pool.query('SELECT count(*) FROM conversations'),
    ])
    const byPlan = {}
    subs.rows.forEach((r) => (byPlan[r.plan_code] = Number(r.count)))
    res.json({
      users: Number(users.rows[0].count),
      byPlan,
      messagesToday: Number(msgs.rows[0].c),
      apiKeys: Number(keys.rows[0].count),
      conversations: Number(convs.rows[0].count),
    })
  } catch (err) {
    console.error('[admin] stats error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function adminUsers(req, res) {
  const q = typeof req.query.query === 'string' ? req.query.query.trim() : ''
  const like = '%' + q + '%'
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.phone, u.name, u.is_admin, u.created_at,
              (SELECT plan_code FROM subscriptions s
                 WHERE s.user_id = u.id AND s.status = 'active'
                   AND (s.current_period_end IS NULL OR s.current_period_end > now())
                 ORDER BY s.created_at DESC LIMIT 1) AS plan,
              coalesce((SELECT count FROM usage_daily d WHERE d.user_id = u.id AND d.day = CURRENT_DATE), 0) AS today
         FROM users u
        WHERE ($1 = '' OR u.email ILIKE $2 OR u.phone ILIKE $2 OR u.name ILIKE $2)
        ORDER BY u.id DESC LIMIT 100`,
      [q, like],
    )
    res.json({
      users: rows.map((r) => ({
        id: String(r.id),
        email: r.email,
        phone: r.phone,
        name: r.name,
        isAdmin: r.is_admin,
        createdAt: r.created_at,
        plan: r.plan || DEFAULT_PLAN,
        today: Number(r.today),
      })),
    })
  } catch (err) {
    console.error('[admin] users error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function adminUpdateUser(req, res) {
  const id = req.params.id
  const body = req.body || {}
  try {
    if (typeof body.isAdmin === 'boolean') {
      await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [body.isAdmin, id])
    }
    if (typeof body.plan === 'string' && body.plan) {
      await grantPlan(id, body.plan)
    }
    res.json({ ok: true })
  } catch (err) {
    if (err.message === 'bad_plan') return res.status(400).json({ error: 'bad_plan', message: 'پلن نامعتبر است.' })
    console.error('[admin] update error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}

export async function adminDeleteUser(req, res) {
  const id = req.params.id
  if (String(id) === String(req.user.id)) {
    return res.status(400).json({ error: 'self', message: 'نمی‌تونی حسابِ خودت رو حذف کنی.' })
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id])
    if (!rowCount) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin] delete error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}
