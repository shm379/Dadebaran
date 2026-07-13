// Subscription plans. Defined in code so they're easy to extend; the DB only
// stores which plan a user is on (see billing.mjs). `limits.dailyMessages: null`
// means unlimited. Prices are illustrative (Toman) — wire a real provider in
// billing.mjs when ready.
export const PLANS = [
  {
    code: 'free',
    name: 'رایگان',
    price: 0,
    currency: 'IRT',
    priceLabel: 'رایگان',
    period: 'ماهانه',
    limits: { dailyMessages: 20 },
    features: ['۲۰ پیام در روز', 'دسترسی به دستیارهای پایه', 'مدل پیش‌فرض'],
  },
  {
    code: 'pro',
    name: 'حرفه‌ای',
    price: 99000,
    currency: 'IRT',
    priceLabel: '۹۹,۰۰۰ تومان',
    period: 'ماهانه',
    limits: { dailyMessages: null },
    features: ['پیام نامحدود', 'همه‌ی مدل‌ها', 'کارهای زمان‌بندی‌شده', 'آپلود تصویر و ویدیو', 'گفت‌وگوی صوتی'],
  },
  {
    code: 'business',
    name: 'سازمانی',
    price: 349000,
    currency: 'IRT',
    priceLabel: '۳۴۹,۰۰۰ تومان',
    period: 'ماهانه',
    limits: { dailyMessages: null },
    features: ['همه‌ی امکاناتِ حرفه‌ای', 'چند کاربر', 'پشتیبانی اولویت‌دار', 'اتصال به نبوگیت اختصاصی'],
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

// Public shape (no internal fields to hide today, but keeps a single seam).
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
