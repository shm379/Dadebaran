// Subscription + usage. Kept provider-agnostic: today the default provider is
// "manual" (checkout activates immediately), but checkout() is the single seam
// where a real gateway (Stripe, Zarinpal, …) returns a redirect URL instead.
import { pool } from './db.mjs'
import { getPlan, isValidPlan, publicPlan, DEFAULT_PLAN, PLANS } from './plans.mjs'

const PROVIDER = process.env.BILLING_PROVIDER || 'manual'
const PERIOD_DAYS = 30

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
  if (limit == null) return { allowed: true, used: null, limit: null, planCode }
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
export async function checkout(userId, planCode) {
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

  if (PROVIDER !== 'manual') {
    // Seam for a real payment provider: create a checkout session and return
    // its redirect URL; the provider webhook then activates the subscription.
    return {
      status: 501,
      body: { error: 'provider_not_configured', message: 'درگاه پرداخت هنوز پیکربندی نشده است.' },
    }
  }

  const periodEnd = new Date(Date.now() + PERIOD_DAYS * 86400 * 1000)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = now()
        WHERE user_id = $1 AND status = 'active'`,
      [userId],
    )
    await client.query(
      `INSERT INTO subscriptions (user_id, plan_code, status, provider, current_period_end)
       VALUES ($1, $2, 'active', 'manual', $3)`,
      [userId, planCode, periodEnd],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
  return { status: 200, body: { activated: true, ...(await getStatus(userId)) } }
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
