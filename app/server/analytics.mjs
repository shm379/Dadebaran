// Usage analytics for the admin panel. Reads from usage_daily (per-user/day
// message counts), model_usage_daily (per-model/day), and users.
import { pool } from './db.mjs'

// Called after a successful completion to attribute a message to a model.
export async function recordModelUsage(model) {
  const m = (model || 'default').slice(0, 120)
  try {
    await pool.query(
      `INSERT INTO model_usage_daily (day, model, count) VALUES (CURRENT_DATE, $1, 1)
       ON CONFLICT (day, model) DO UPDATE SET count = model_usage_daily.count + 1`,
      [m],
    )
  } catch {
    /* analytics are best-effort */
  }
}

function userLabel(r) {
  return r.email || r.phone || r.name || 'کاربر ' + r.id
}

export async function adminAnalytics(req, res) {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14))
  const span = days - 1
  try {
    const [messages, newUsers, topModels, topUsers, active] = await Promise.all([
      pool.query(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(u.c, 0)::int AS count
           FROM generate_series(CURRENT_DATE - $1::int, CURRENT_DATE, interval '1 day') d
           LEFT JOIN (SELECT day, sum(count) c FROM usage_daily GROUP BY day) u ON u.day = d::date
          ORDER BY d`,
        [span],
      ),
      pool.query(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(u.c, 0)::int AS count
           FROM generate_series(CURRENT_DATE - $1::int, CURRENT_DATE, interval '1 day') d
           LEFT JOIN (SELECT created_at::date AS day, count(*) c FROM users GROUP BY 1) u ON u.day = d::date
          ORDER BY d`,
        [span],
      ),
      pool.query(
        `SELECT model, sum(count)::int c FROM model_usage_daily
          WHERE day >= CURRENT_DATE - $1::int GROUP BY model ORDER BY c DESC LIMIT 8`,
        [span],
      ),
      pool.query(
        `SELECT u.id, u.email, u.phone, u.name, sum(d.count)::int c
           FROM usage_daily d JOIN users u ON u.id = d.user_id
          WHERE d.day >= CURRENT_DATE - $1::int
          GROUP BY u.id ORDER BY c DESC LIMIT 8`,
        [span],
      ),
      pool.query(
        `SELECT
           (SELECT count(DISTINCT user_id) FROM usage_daily WHERE day = CURRENT_DATE)::int AS today,
           (SELECT count(DISTINCT user_id) FROM usage_daily WHERE day >= CURRENT_DATE - 6)::int AS week`,
      ),
    ])
    res.json({
      days,
      messagesByDay: messages.rows,
      newUsersByDay: newUsers.rows,
      topModels: topModels.rows.map((r) => ({ model: r.model, count: r.c })),
      topUsers: topUsers.rows.map((r) => ({ id: String(r.id), label: userLabel(r), count: r.c })),
      activeToday: active.rows[0].today,
      activeWeek: active.rows[0].week,
      totalMessages: messages.rows.reduce((s, r) => s + r.count, 0),
    })
  } catch (err) {
    console.error('[admin] analytics error:', err.message)
    res.status(503).json({ error: 'server' })
  }
}
