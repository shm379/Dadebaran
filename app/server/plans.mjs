// Subscription plans. Defined in code so they're easy to extend; the DB only
// stores which plan a user is on (see billing.mjs). `limits.dailyMessages: null`
// means unlimited. `models` is either '*' (all models) or a list of model ids
// allowed on that plan — the free plan is limited to FREE_MODEL_IDS. Prices are
// illustrative (Toman).

// Which model ids the free plan may use. Defaults to the gateway's default model.
const FREE_MODEL_IDS = (process.env.FREE_MODEL_IDS || process.env.NABUGATE_MODEL || 'nabu-fast')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const PLANS = [
  {
    code: 'free',
    name: 'رایگان',
    price: 0,
    currency: 'IRT',
    priceLabel: 'رایگان',
    period: 'ماهانه',
    limits: { dailyMessages: 20 },
    models: FREE_MODEL_IDS,
    features: ['۲۰ پیام در روز', 'دسترسی به دستیارهای پایه', 'فقط مدلِ پایه'],
  },
  {
    code: 'pro',
    name: 'حرفه‌ای',
    price: 99000,
    currency: 'IRT',
    priceLabel: '۹۹,۰۰۰ تومان',
    period: 'ماهانه',
    limits: { dailyMessages: null },
    models: '*',
    features: ['پیام نامحدود', 'دسترسی به همه‌ی مدل‌ها', 'کارهای زمان‌بندی‌شده', 'آپلود تصویر و ویدیو', 'گفت‌وگوی صوتی'],
  },
  {
    code: 'business',
    name: 'سازمانی',
    price: 349000,
    currency: 'IRT',
    priceLabel: '۳۴۹,۰۰۰ تومان',
    period: 'ماهانه',
    limits: { dailyMessages: null },
    models: '*',
    features: ['همه‌ی امکاناتِ حرفه‌ای', 'کلیدهای API', 'پشتیبانی اولویت‌دار', 'اتصال به نبوگیت اختصاصی'],
  },
]

export const DEFAULT_PLAN = 'free'

const byCode = new Map(PLANS.map((p) => [p.code, p]))

export function getPlan(code) {
  return byCode.get(code) || byCode.get(DEFAULT_PLAN)
}

export function isValidPlan(code) {
  return byCode.has(code)
}

export function modelAllowedForPlan(planCode, modelId) {
  const plan = getPlan(planCode)
  if (plan.models === '*') return true
  return Array.isArray(plan.models) && plan.models.includes(modelId)
}

// The cheapest plan that unlocks a model (PLANS is ordered ascending by price).
export function requiredPlanForModel(modelId) {
  for (const p of PLANS) {
    if (p.models === '*' || (Array.isArray(p.models) && p.models.includes(modelId))) return p.code
  }
  return 'pro'
}

// Public shape.
export function publicPlan(p) {
  return {
    code: p.code,
    name: p.name,
    price: p.price,
    currency: p.currency,
    priceLabel: p.priceLabel,
    period: p.period,
    limits: p.limits,
    features: p.features,
  }
}
