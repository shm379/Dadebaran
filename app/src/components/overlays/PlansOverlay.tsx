import { useEffect, useState } from 'react'
import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { billing, ApiError } from '../../api'
import { useToast } from '../../state/ToastProvider'
import { useBilling } from '../../state/BillingProvider'
import type { PaymentRecord, Plan, SubscriptionStatus } from '../../types'

const FA = '۰۱۲۳۴۵۶۷۸۹'
const fa = (s: string | number) => String(s).replace(/[0-9]/g, (d) => FA[+d])
// Rial → Toman (÷10) with Persian thousands separators.
const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
const toman = (rial: number) => fa(grp(rial / 10))
const dateFa = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PlansOverlay({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const { refresh } = useBilling()
  const [plans, setPlans] = useState<Plan[]>([])
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [reconciling, setReconciling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  const loadPayments = () => billing.payments().then(setPayments).catch(() => {})

  useEffect(() => {
    let alive = true
    Promise.all([billing.plans(), billing.status()])
      .then(([p, s]) => {
        if (!alive) return
        setPlans(p)
        setStatus(s)
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    loadPayments()
    return () => {
      alive = false
    }
  }, [])

  const currentCode = status?.plan.code || 'free'

  async function choose(code: string) {
    if (code === currentCode || pending) return
    setPending(code)
    try {
      const next = await billing.checkout(code)
      // Zibal (or any real gateway) — hand off to the payment page.
      if (next.checkoutUrl) {
        showToast('در حال انتقال به درگاهِ پرداخت…')
        window.location.assign(next.checkoutUrl)
        return
      }
      setStatus(next as SubscriptionStatus)
      refresh()
      showToast(code === 'free' ? 'به پلنِ رایگان برگشتی' : 'اشتراک فعال شد ✓')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'انجام نشد؛ دوباره امتحان کن.')
    } finally {
      setPending(null)
    }
  }

  async function reconcile() {
    if (reconciling) return
    setReconciling(true)
    try {
      const r = await billing.reconcile()
      setStatus(r)
      refresh()
      if (r.reconciled) loadPayments()
      showToast(r.reconciled ? 'پرداختت پیدا و فعال شد ✓' : 'پرداختِ در انتظاری پیدا نشد.')
    } catch {
      showToast('بررسی نشد؛ دوباره امتحان کن.')
    } finally {
      setReconciling(false)
    }
  }

  // Stop auto-renewal. Access continues until the paid period ends, so the
  // confirmation says so rather than implying instant loss.
  async function cancelSubscription() {
    if (cancelBusy) return
    setCancelBusy(true)
    try {
      const next = await billing.cancel()
      setStatus(next)
      refresh()
      setConfirmCancel(false)
      showToast(next.subscription?.cancelAtPeriodEnd ? 'تمدیدِ خودکار لغو شد' : 'اشتراک لغو شد')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'لغو نشد؛ دوباره امتحان کن.')
    } finally {
      setCancelBusy(false)
    }
  }

  async function resumeSubscription() {
    if (cancelBusy) return
    setCancelBusy(true)
    try {
      const next = await billing.resume()
      setStatus(next)
      refresh()
      showToast('تمدیدِ خودکار دوباره فعال شد ✓')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'انجام نشد؛ دوباره امتحان کن.')
    } finally {
      setCancelBusy(false)
    }
  }

  const usage = status?.usage
  const sub = status?.subscription
  const isPaid = currentCode !== 'free' && !!sub
  const endsOn = sub?.currentPeriodEnd ? fa(dateFa(sub.currentPeriodEnd)) : null

  return (
    <div style={css('position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto;background:radial-gradient(circle at 50% 0%,rgba(255,196,64,.14),transparent 55%),rgba(8,10,20,.86);backdrop-filter:blur(16px);')}>
      <div style={css('position:relative;width:min(880px,96vw);padding:26px 24px;border-radius:24px;background:rgba(15,17,32,.78);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;gap:20px;')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;')}>
          <div style={css('display:flex;align-items:center;gap:11px;')}>
            <div style={css('width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(255,196,64,.16);border:1px solid rgba(255,255,255,.14);color:#ffd884;')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 8l4 3 4-5 4 5 4-3-1.5 10.5h-13L4 8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={css('display:flex;flex-direction:column;line-height:1.3;')}>
              <strong style={css('font-size:1.05rem;font-weight:800;')}>پلن‌ها و اشتراک</strong>
              <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>پلنِ مناسبت رو انتخاب کن</span>
            </div>
          </div>
          <HoverButton
            onClick={onClose}
            aria-label="بستن"
            styleStr="width:34px;height:34px;display:grid;place-items:center;border-radius:10px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);"
            hoverStr="background:rgba(255,255,255,.16);"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </HoverButton>
        </div>

        {usage && (
          <div style={css('font-size:.82rem;color:rgba(245,250,255,.7);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:11px 14px;')}>
            پلنِ فعلی: <strong style={css('color:#eaf2ff;')}>{status?.plan.name}</strong>
            {' · '}
            {usage.limit == null
              ? 'پیام نامحدود'
              : `مصرفِ امروز: ${usage.used} از ${usage.limit}`}
          </div>
        )}

        {isPaid &&
          (sub.cancelAtPeriodEnd ? (
            // Cancellation is pending — access continues until the period ends.
            <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:.82rem;background:rgba(255,196,64,.09);border:1px solid rgba(255,196,64,.3);border-radius:12px;padding:11px 14px;')}>
              <span style={css('flex:1;min-width:200px;color:rgba(255,226,160,.92);line-height:1.7;')}>
                تمدیدِ خودکار لغو شده
                {endsOn && <> — دسترسیت تا <strong style={css('color:#ffd884;')}>{endsOn}</strong> فعاله.</>}
              </span>
              <HoverButton
                onClick={resumeSubscription}
                disabled={cancelBusy}
                styleStr={
                  'flex:none;padding:.45rem .85rem;border-radius:10px;font-size:.8rem;font-weight:700;cursor:pointer;color:#ffd884;background:rgba(255,196,64,.14);border:1px solid rgba(255,196,64,.45);' +
                  (cancelBusy ? 'opacity:.6;' : '')
                }
                hoverStr="background:rgba(255,196,64,.26);"
              >
                {cancelBusy ? 'کمی صبر کن…' : 'ادامه دادنِ اشتراک'}
              </HoverButton>
            </div>
          ) : confirmCancel ? (
            <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.82rem;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.3);border-radius:12px;padding:11px 14px;')}>
              <span style={css('flex:1;min-width:200px;color:rgba(255,196,196,.92);line-height:1.7;')}>
                مطمئنی؟ تمدیدِ خودکار متوقف می‌شه
                {endsOn ? (
                  <> ولی تا <strong style={css('color:#ffbcbc;')}>{endsOn}</strong> دسترسیت باقی می‌مونه.</>
                ) : (
                  <> و پلنت به رایگان برمی‌گرده.</>
                )}
              </span>
              <HoverButton
                onClick={cancelSubscription}
                disabled={cancelBusy}
                styleStr={
                  'flex:none;padding:.45rem .85rem;border-radius:10px;font-size:.8rem;font-weight:700;cursor:pointer;color:#ffcaca;background:rgba(255,80,80,.16);border:1px solid rgba(255,80,80,.45);' +
                  (cancelBusy ? 'opacity:.6;' : '')
                }
                hoverStr="background:rgba(255,80,80,.3);"
              >
                {cancelBusy ? 'در حال لغو…' : 'بله، لغو کن'}
              </HoverButton>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelBusy}
                style={css('flex:none;background:none;border:0;cursor:pointer;color:rgba(245,250,255,.6);font-family:inherit;font-size:.8rem;font-weight:700;')}
              >
                بی‌خیال
              </button>
            </div>
          ) : (
            <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:.8rem;color:rgba(245,250,255,.55);padding:0 3px;')}>
              <span style={css('flex:1;min-width:180px;')}>
                {endsOn ? <>تمدیدِ خودکار در {endsOn}</> : <>اشتراکِ فعال</>}
              </span>
              <button
                onClick={() => setConfirmCancel(true)}
                style={css('flex:none;background:none;border:0;cursor:pointer;color:rgba(255,150,150,.85);font-family:inherit;font-size:.8rem;font-weight:700;')}
              >
                لغوِ اشتراک
              </button>
            </div>
          ))}

        {loading ? (
          <div style={css('text-align:center;padding:30px;color:rgba(245,250,255,.5);')}>در حال بارگذاری…</div>
        ) : (
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;')}>
            {plans.map((p) => {
              const isCurrent = p.code === currentCode
              const isPending = pending === p.code
              return (
                <div
                  key={p.code}
                  style={css(
                    'display:flex;flex-direction:column;gap:14px;padding:18px 17px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid ' +
                      (isCurrent ? 'rgba(22,122,254,.6)' : 'rgba(255,255,255,.1)') +
                      ';box-shadow:' +
                      (isCurrent ? 'inset 0 0 50px rgba(22,122,254,.14)' : 'none') +
                      ';',
                  )}
                >
                  <div style={css('display:flex;flex-direction:column;gap:3px;')}>
                    <strong style={css('font-size:1.05rem;font-weight:800;color:#f3f8ff;')}>{p.name}</strong>
                    <div style={css('display:flex;align-items:baseline;gap:6px;')}>
                      <span style={css('font-size:1.15rem;font-weight:800;color:#60b0ff;')}>{p.priceLabel}</span>
                      {p.price > 0 && <span style={css('font-size:.72rem;color:rgba(245,250,255,.5);')}>/ {p.period}</span>}
                    </div>
                  </div>
                  <div style={css('display:flex;flex-direction:column;gap:8px;flex:1;')}>
                    {p.features.map((f, i) => (
                      <div key={i} style={css('display:flex;gap:8px;align-items:flex-start;font-size:.82rem;line-height:1.6;color:rgba(245,250,255,.8);')}>
                        <span style={css('flex:none;margin-top:2px;color:#60b0ff;')}>✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrent ? (
                    <div style={css('text-align:center;padding:.6rem;border-radius:12px;font-size:.85rem;font-weight:700;color:#bcd9ff;background:rgba(22,122,254,.16);border:1px solid rgba(22,122,254,.4);')}>
                      پلنِ فعلی
                    </div>
                  ) : (
                    <HoverButton
                      onClick={() => choose(p.code)}
                      disabled={isPending}
                      styleStr={
                        'text-align:center;padding:.7rem;border-radius:12px;font-size:.88rem;font-weight:700;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);' +
                        (isPending ? 'opacity:.7;' : '')
                      }
                      hoverStr="filter:brightness(1.06);transform:translateY(-1px);"
                    >
                      {isPending ? 'کمی صبر کن…' : p.code === 'free' ? 'بازگشت به رایگان' : 'انتخابِ این پلن'}
                    </HoverButton>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {payments.length > 0 && (
          <div style={css('display:flex;flex-direction:column;gap:9px;')}>
            <div style={css('height:1px;background:rgba(255,255,255,.08);')} />
            <div style={css('font-size:.86rem;font-weight:800;color:#f3f8ff;')}>تاریخچهٔ پرداخت‌ها</div>
            <div style={css('display:flex;flex-direction:column;gap:7px;max-height:30vh;overflow-y:auto;')}>
              {payments.map((p) => (
                <div
                  key={p.id}
                  style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 13px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);')}
                >
                  <div style={css('flex:1;min-width:150px;display:flex;flex-direction:column;gap:2px;')}>
                    <span style={css('font-size:.86rem;color:#eaf2ff;font-weight:600;')}>اشتراکِ {p.planName}</span>
                    <span style={css('font-size:.7rem;color:rgba(245,250,255,.5);')}>
                      {fa(dateFa(p.createdAt))}
                      {p.ref && <span style={css('color:rgba(245,250,255,.38);')}>{' · کدِ پیگیری: ' + fa(p.ref)}</span>}
                    </span>
                  </div>
                  <div style={css('display:flex;align-items:center;gap:8px;')}>
                    <span style={css('font-size:.9rem;font-weight:800;color:#7ee0a8;white-space:nowrap;')}>
                      {toman(p.amount)} <span style={css('font-size:.7rem;font-weight:600;color:rgba(126,224,168,.7);')}>تومان</span>
                    </span>
                    <span style={css('font-size:.66rem;font-weight:700;color:#7ee0a8;background:rgba(126,224,168,.12);border:1px solid rgba(126,224,168,.3);border-radius:99px;padding:2px 8px;')}>
                      موفق
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={css('display:flex;flex-direction:column;align-items:center;gap:8px;')}>
          <button
            onClick={reconcile}
            disabled={reconciling}
            style={css('background:none;border:0;cursor:pointer;color:#60b0ff;font-weight:700;font-family:inherit;font-size:.8rem;')}
          >
            {reconciling ? 'در حال بررسی…' : 'پرداخت کردی ولی فعال نشد؟ بررسی کن'}
          </button>
          <div style={css('font-size:.72rem;color:rgba(245,250,255,.42);line-height:1.7;text-align:center;')}>
            با انتخابِ پلنِ پولی به درگاهِ پرداختِ زیبال منتقل می‌شوی. (حالتِ نمایشی بلافاصله فعال می‌کند.)
          </div>
        </div>
      </div>
    </div>
  )
}
