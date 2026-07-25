// Subscription + usage. Kept provider-agnostic: today the default provider is
// "manual" (checkout activates immediately), but checkout() is the single seam
// where a real gateway (Stripe, Zarinpal, …) returns a redirect URL instead.
import { pool } from './db.mjs'
import { getPlan, isValidPlan, publicPlan, DEFAULT_PLAN, PLANS } from './plans.mjs'
import * as zibal from './providers/zibal.mjs'

const PROVIDER = process.env.BILLING_PROVIDER || 'manual'
const PERIOD_DAYS = 30

function appBaseUrl() {
  return (process.env.APP_BASE_URL || '').replace(/\/+$/, '')
}

// Make one subscription row the sole active one for a user, atomically.
async function activateSubscription(userId, subId) {
  const periodEnd = new Date(Date.now() + PERIOD_DAYS * 86400 * 1000)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = now()
        WHERE user_id = $1 AND status = 'active' AND id <> $2`,
      [userId, subId],
    )
    await client.query(
      `UPDATE subscriptions SET status = 'active', current_period_end = $1, cancel_at_period_end = false, updated_at = now()
        WHERE id = $2`,
      [periodEnd, subId],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function getActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT id, plan_code, status, provider, current_period_end, cancel_at_period_end, created_at
       FROM subscriptions
      WHERE user_id = $1 AND status = 'active'
        AND (current_period_end IS NULL OR current_period_end > now())
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [userId],
  )
  return rows[0] || null
}

export async function currentPlanCode(userId) {
  const sub = await getActiveSubscription(userId)
  return sub ? sub.plan_code : DEFAULT_PLAN
}

async function usageToday(userId) {
  const { rows } = await pool.query(
    `SELECT count FROM usage_daily WHERE user_id = $1 AND day = CURRENT_DATE`,
    [userId],
  )
  return rows[0] ? Number(rows[0].count) : 0
}

/**
 * Atomically reserve one message against today's quota. A single statement
 * increments the counter only while it is below the plan limit, so concurrent
 * requests can't both slip past the gate (fixes the check-then-act race).
 * Returns { allowed, used, limit, planCode }.
 */
export async function consumeQuota(userId) {
  const planCode = await currentPlanCode(userId)
  const limit = getPlan(planCode).limits.dailyMessages // null = unlimited
  if (limit == null) {
    // Unlimited plans are always allowed, but we still record the message so
    // analytics and per-user totals include paid users.
    await pool.query(
      `INSERT INTO usage_daily (user_id, day, count) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET count = usage_daily.count + 1`,
      [userId],
    )
    return { allowed: true, used: null, limit: null, planCode }
  }
  const { rows } = await pool.query(
    `INSERT INTO usage_daily (user_id, day, count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day)
       DO UPDATE SET count = usage_daily.count + 1
       WHERE usage_daily.count < $2
     RETURNING count`,
    [userId, limit],
  )
  if (rows.length) return { allowed: true, used: Number(rows[0].count), limit, planCode }
  return { allowed: false, used: await usageToday(userId), limit, planCode }
}

/** Give back a reserved slot when the model call fails, so failures aren't billed. */
export async function refundQuota(userId) {
  await pool.query(
    `UPDATE usage_daily SET count = GREATEST(count - 1, 0)
      WHERE user_id = $1 AND day = CURRENT_DATE`,
    [userId],
  )
}

export async function getStatus(userId) {
  const sub = await getActiveSubscription(userId)
  const planCode = sub ? sub.plan_code : DEFAULT_PLAN
  const plan = getPlan(planCode)
  const used = await usageToday(userId)
  const limit = plan.limits.dailyMessages
  return {
    plan: publicPlan(plan),
    subscription: sub
      ? {
          planCode: sub.plan_code,
          status: sub.status,
          provider: sub.provider,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      : null,
    usage: { used, limit, remaining: limit == null ? null : Math.max(0, limit - used) },
  }
}

export function listPlans() {
  return PLANS.map(publicPlan)
}

/**
 * Start (or switch) a subscription.
 * - free plan: clears any paid subscription immediately.
 * - manual provider: activates immediately, inside a transaction so the user is
 *   never left with zero active subscriptions on a partial failure.
 * - real provider (future): return { checkoutUrl } to redirect the user.
 */
// Admin-granted plan change (no payment). free = clear; paid = activate now.
export async function grantPlan(userId, planCode) {
  if (!isValidPlan(planCode)) throw new Error('bad_plan')
  if (planCode === 'free') {
    await pool.query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE user_id = $1 AND status = 'active'`,
      [userId],
    )
    return
  }
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan_code, status, provider) VALUES ($1, $2, 'pending', 'admin') RETURNING id`,
    [userId, planCode],
  )
  await activateSubscription(userId, rows[0].id)
}

export async function checkout(userId, planCode, opts = {}) {
  if (!isValidPlan(planCode)) {
    return { status: 400, body: { error: 'bad_plan', message: 'پلن نامعتبر است.' } }
  }

  if (planCode === 'free') {
    await pool.query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = now()
        WHERE user_id = $1 AND status = 'active'`,
      [userId],
    )
    return { status: 200, body: { activated: true, ...(await getStatus(userId)) } }
  }

  const plan = getPlan(planCode)

  if (PROVIDER === 'zibal') {
    const base = appBaseUrl()
    if (!base) {
      return { status: 500, body: { error: 'config', message: 'آدرسِ برنامه (APP_BASE_URL) تنظیم نشده.' } }
    }
    // Record a pending subscription; its id is the Zibal orderId.
    const { rows } = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_code, status, provider) VALUES ($1, $2, 'pending', 'zibal') RETURNING id`,
      [userId, planCode],
    )
    const subId = rows[0].id
    try {
      const { trackId, payUrl } = await zibal.requestPayment({
        amount: plan.price * 10, // Toman -> Rial
        orderId: subId,
        description: `اشتراکِ ${plan.name} — MR.CHATGPT`,
        mobile: opts.mobile || undefined,
        callbackUrl: `${base}/api/billing/zibal/callback`,
      })
      await pool.query(`UPDATE subscriptions SET provider_ref = $1, updated_at = now() WHERE id = $2`, [trackId, subId])
      return { status: 200, body: { checkoutUrl: payUrl } }
    } catch (err) {
      await pool.query(`UPDATE subscriptions SET status = 'failed', updated_at = now() WHERE id = $1`, [subId]).catch(() => {})
      console.error('[zibal] request failed:', err.message)
      return { status: 502, body: { error: 'gateway', message: 'اتصال به درگاهِ پرداخت ناموفق بود. دوباره امتحان کن.' } }
    }
  }

  if (PROVIDER !== 'manual') {
    return { status: 501, body: { error: 'provider_not_configured', message: 'درگاه پرداخت پیکربندی نشده است.' } }
  }

  // manual (demo) — activate immediately in a transaction.
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan_code, status, provider) VALUES ($1, $2, 'pending', 'manual') RETURNING id`,
    [userId, planCode],
  )
  await activateSubscription(userId, rows[0].id)
  return { status: 200, body: { activated: true, ...(await getStatus(userId)) } }
}

/**
 * Verify a Zibal payment (called from the callback) and activate the matching
 * pending subscription. Idempotent: a repeated callback for an already-active
 * subscription is a no-op success.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
// Record a completed payment (best-effort; drives revenue analytics).
export async function recordPayment({ userId, planCode, amount, provider = 'zibal', ref = null, trackId = null }) {
  try {
    await pool.query(
      `INSERT INTO payments (user_id, plan_code, amount, currency, provider, ref, track_id) VALUES ($1, $2, $3, 'IRR', $4, $5, $6)`,
      [userId, planCode, Math.round(amount || 0), provider, ref, trackId],
    )
  } catch (err) {
    console.warn('[billing] recordPayment failed:', err.message)
  }
}

// The signed-in user's own payment history (most recent first).
export async function listPayments(userId) {
  const { rows } = await pool.query(
    `SELECT id, plan_code, amount, currency, provider, ref, created_at
       FROM payments WHERE user_id = $1 ORDER BY id DESC LIMIT 50`,
    [userId],
  )
  return rows.map((r) => ({
    id: String(r.id),
    planCode: r.plan_code,
    planName: getPlan(r.plan_code).name,
    amount: Number(r.amount), // Rial
    currency: r.currency,
    provider: r.provider,
    ref: r.ref,
    createdAt: r.created_at,
  }))
}

export async function verifyAndActivateZibal(trackId) {
  if (!trackId) return { ok: false, reason: 'no_track' }
  const { rows } = await pool.query(
    `SELECT id, user_id, plan_code, status FROM subscriptions WHERE provider = 'zibal' AND provider_ref = $1 ORDER BY id DESC LIMIT 1`,
    [trackId],
  )
  const sub = rows[0]
  if (!sub) return { ok: false, reason: 'not_found' }
  if (sub.status === 'active') return { ok: true } // already processed
  const v = await zibal.verifyPayment(trackId)
  if (!v.paid) {
    await pool
      .query(`UPDATE subscriptions SET status = 'failed', updated_at = now() WHERE id = $1 AND status = 'pending'`, [sub.id])
      .catch(() => {})
    return { ok: false, reason: 'not_paid' }
  }
  await activateSubscription(sub.user_id, sub.id)
  await recordPayment({
    userId: sub.user_id,
    planCode: sub.plan_code,
    amount: v.amount || getPlan(sub.plan_code).price * 10,
    provider: 'zibal',
    ref: v.refNumber || null,
    trackId,
  })
  return { ok: true }
}

/**
 * Re-verify the user's most recent pending Zibal payment. Useful when the
 * browser never returned from the gateway but the payment actually went through.
 */
export async function reconcile(userId) {
  const { rows } = await pool.query(
    `SELECT provider_ref FROM subscriptions
      WHERE user_id = $1 AND provider = 'zibal' AND status = 'pending' AND provider_ref IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [userId],
  )
  let reconciled = false
  if (rows[0]) {
    const r = await verifyAndActivateZibal(rows[0].provider_ref)
    reconciled = r.ok
  }
  return { status: 200, body: { reconciled, ...(await getStatus(userId)) } }
}

/** Stop auto-renewal but keep access until the paid period ends. */
export async function cancel(userId) {
  const sub = await getActiveSubscription(userId)
  if (sub && sub.current_period_end) {
    await pool.query(
      `UPDATE subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE id = $1`,
      [sub.id],
    )
  } else {
    await pool.query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = now()
        WHERE user_id = $1 AND status = 'active'`,
      [userId],
    )
  }
  return { status: 200, body: { ...(await getStatus(userId)) } }
}

/**
 * Undo a pending cancellation — auto-renewal resumes. Only meaningful while the
 * paid period is still running; once it lapses there is no active row to resume
 * and the user has to subscribe again.
 */
export async function resume(userId) {
  const sub = await getActiveSubscription(userId)
  if (!sub) {
    return { status: 400, body: { error: 'no_subscription', message: 'اشتراکِ فعالی برای ادامه دادن نیست.' } }
  }
  await pool.query(
    `UPDATE subscriptions SET cancel_at_period_end = false, updated_at = now() WHERE id = $1`,
    [sub.id],
  )
  return { status: 200, body: { ...(await getStatus(userId)) } }
}
