// Subscription + usage. Kept provider-agnostic: today the default provider is
// "manual" (checkout activates immediately), but checkout() is the single seam
// where a real gateway (Stripe, Zarinpal, …) returns a redirect URL instead.
import { pool } from './db.mjs'
import { getPlan, isValidPlan, publicPlan, DEFAULT_PLAN, PLANS } from './plans.mjs'

const PROVIDER = process.env.BILLING_PROVIDER || 'manual'
const PERIOD_DAYS = 30

export async function getActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT id, plan_code, status, provider, current_period_end, created_at
       FROM subscriptions
      WHERE user_id = $1 AND status = 'active'
        AND (current_period_end IS NULL OR current_period_end > now())
      ORDER BY created_at DESC
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

export async function incrementUsage(userId) {
  await pool.query(
    `INSERT INTO usage_daily (user_id, day, count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET count = usage_daily.count + 1`,
    [userId],
  )
}

// { allowed, used, limit, remaining, planCode }
export async function checkQuota(userId) {
  const planCode = await currentPlanCode(userId)
  const plan = getPlan(planCode)
  const limit = plan.limits.dailyMessages // null = unlimited
  const used = await usageToday(userId)
  const allowed = limit == null || used < limit
  return { allowed, used, limit, remaining: limit == null ? null : Math.max(0, limit - used), planCode }
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
        }
      : null,
    usage: { used, limit, remaining: limit == null ? null : Math.max(0, limit - used) },
  }
}

export function listPlans() {
  return PLANS.map(publicPlan)
}

async function deactivateAll(userId) {
  await pool.query(
    `UPDATE subscriptions SET status = 'canceled', updated_at = now()
      WHERE user_id = $1 AND status = 'active'`,
    [userId],
  )
}

/**
 * Start (or switch) a subscription.
 * - free plan: just clears any paid subscription.
 * - manual provider: activates immediately.
 * - real provider (future): return { checkoutUrl } to redirect the user.
 */
export async function checkout(userId, planCode) {
  if (!isValidPlan(planCode)) {
    return { status: 400, body: { error: 'bad_plan', message: 'پلن نامعتبر است.' } }
  }
  if (planCode === 'free') {
    await deactivateAll(userId)
    return { status: 200, body: { activated: true, ...(await getStatus(userId)) } }
  }

  if (PROVIDER !== 'manual') {
    // Seam for a real payment provider. Implement createCheckoutSession() per
    // provider and return its redirect URL; the webhook then activates the sub.
    return {
      status: 501,
      body: { error: 'provider_not_configured', message: 'درگاه پرداخت هنوز پیکربندی نشده است.' },
    }
  }

  await deactivateAll(userId)
  const periodEnd = new Date(Date.now() + PERIOD_DAYS * 86400 * 1000)
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_code, status, provider, current_period_end)
     VALUES ($1, $2, 'active', 'manual', $3)`,
    [userId, planCode, periodEnd],
  )
  return { status: 200, body: { activated: true, ...(await getStatus(userId)) } }
}

export async function cancel(userId) {
  await deactivateAll(userId)
  return { status: 200, body: { ...(await getStatus(userId)) } }
}
