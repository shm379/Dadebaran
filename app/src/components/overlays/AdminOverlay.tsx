import { useEffect, useState } from 'react'
import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { admin, billing, ApiError } from '../../api'
import { useToast } from '../../state/ToastProvider'
import { Analytics } from '../admin/Analytics'
import type { AdminStats, AdminUser, AuditEntry, Plan } from '../../types'

const FA = '۰۱۲۳۴۵۶۷۸۹'
const fa = (s: string | number) => String(s).replace(/[0-9]/g, (d) => FA[+d])

const timeFa = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={css('flex:1;min-width:110px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:4px;')}>
      <span style={css('font-size:1.3rem;font-weight:800;color:#f3f8ff;')}>{value}</span>
      <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>{label}</span>
    </div>
  )
}

export function AdminOverlay({ onClose, currentUserId }: { onClose: () => void; currentUserId: string }) {
  const { showToast } = useToast()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadUsers = (q: string) => admin.users(q).then(setUsers).catch(() => {})
  const loadAudit = () => admin.audit().then(setAudit).catch(() => {})

  useEffect(() => {
    Promise.all([
      admin.stats().then(setStats).catch(() => {}),
      billing.plans().then(setPlans).catch(() => {}),
      loadUsers(''),
      loadAudit(),
    ]).finally(() => setLoading(false))
  }, [])

  async function changePlan(u: AdminUser, plan: string) {
    try {
      await admin.updateUser(u.id, { plan })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, plan } : x)))
      showToast('پلن تغییر کرد ✓')
      loadAudit()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'تغییر نشد')
    }
  }

  async function toggleAdmin(u: AdminUser) {
    try {
      await admin.updateUser(u.id, { isAdmin: !u.isAdmin })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: !u.isAdmin } : x)))
      loadAudit()
    } catch {
      showToast('انجام نشد')
    }
  }

  async function removeUser(u: AdminUser) {
    try {
      await admin.deleteUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      showToast('کاربر حذف شد')
      loadAudit()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'حذف نشد')
    }
  }

  const planName = (code: string) => plans.find((p) => p.code === code)?.name || code

  const auditText = (e: AuditEntry) => {
    if (e.action === 'set_admin') return e.detail === 'true' ? 'اعطای دسترسیِ ادمین' : 'لغوِ دسترسیِ ادمین'
    if (e.action === 'change_plan') return 'تغییرِ پلن به ' + planName(e.detail || '')
    if (e.action === 'delete_user') return 'حذفِ کاربر'
    return e.action
  }

  return (
    <div style={css('position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;overflow-y:auto;background:radial-gradient(circle at 50% 0%,rgba(22,122,254,.18),transparent 55%),rgba(8,10,20,.88);backdrop-filter:blur(16px);')}>
      <div style={css('position:relative;width:min(860px,97vw);padding:24px 22px;border-radius:24px;background:rgba(15,17,32,.8);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;gap:18px;')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;')}>
          <div style={css('display:flex;align-items:center;gap:11px;')}>
            <div style={css('width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);color:#9ecbff;')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={css('display:flex;flex-direction:column;line-height:1.3;')}>
              <strong style={css('font-size:1.05rem;font-weight:800;')}>پنلِ ادمین</strong>
              <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>مدیریتِ کاربران و اشتراک‌ها</span>
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

        {stats && (
          <div style={css('display:flex;flex-wrap:wrap;gap:10px;')}>
            <Stat label="کاربران" value={fa(stats.users)} />
            <Stat label="پیام‌های امروز" value={fa(stats.messagesToday)} />
            <Stat label="اشتراکِ حرفه‌ای" value={fa(stats.byPlan?.pro || 0)} />
            <Stat label="اشتراکِ سازمانی" value={fa(stats.byPlan?.business || 0)} />
            <Stat label="کلیدهای فعال" value={fa(stats.apiKeys)} />
            <Stat label="گفت‌وگوها" value={fa(stats.conversations)} />
          </div>
        )}

        <Analytics />

        <div style={css('height:1px;background:rgba(255,255,255,.08);')} />
        <div style={css('font-size:.9rem;font-weight:800;color:#f3f8ff;')}>کاربران</div>


        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            loadUsers(e.target.value)
          }}
          placeholder="جستجوی کاربر (ایمیل، شماره، نام)"
          style={css('width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);border-radius:12px;color:#f7fbff;font-family:inherit;font-size:.9rem;padding:10px 13px;outline:none;')}
        />

        {loading ? (
          <div style={css('text-align:center;padding:24px;color:rgba(245,250,255,.5);')}>در حال بارگذاری…</div>
        ) : (
          <div style={css('display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto;')}>
            {users.map((u) => {
              const label = u.email || u.phone || u.name || ('کاربر ' + u.id)
              const isSelf = u.id === currentUserId
              return (
                <div
                  key={u.id}
                  style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);')}
                >
                  <div style={css('flex:1;min-width:160px;display:flex;flex-direction:column;gap:2px;')}>
                    <span style={css('font-size:.86rem;color:#eaf2ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')} dir="auto">
                      {label} {u.isAdmin && <span style={css('color:#ffd884;font-size:.7rem;')}>· ادمین</span>}
                    </span>
                    <span style={css('font-size:.7rem;color:rgba(245,250,255,.5);')}>مصرفِ امروز: {fa(u.today)}</span>
                  </div>
                  <select
                    value={u.plan}
                    onChange={(e) => changePlan(u, e.target.value)}
                    style={css('background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:9px;color:#f7fbff;font-family:inherit;font-size:.78rem;padding:6px 8px;outline:none;cursor:pointer;')}
                  >
                    {(plans.length ? plans.map((p) => p.code) : ['free', 'pro', 'business']).map((code) => (
                      <option key={code} value={code} style={css('color:#000;')}>
                        {planName(code)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleAdmin(u)}
                    style={css(
                      'padding:.34rem .6rem;border-radius:9px;font-size:.74rem;font-weight:600;cursor:pointer;border:1px solid ' +
                        (u.isAdmin ? 'rgba(255,196,64,.6)' : 'rgba(255,255,255,.16)') +
                        ';background:' +
                        (u.isAdmin ? 'rgba(255,196,64,.16)' : 'rgba(255,255,255,.05)') +
                        ';color:' +
                        (u.isAdmin ? '#ffd884' : 'rgba(245,250,255,.7)') +
                        ';',
                    )}
                  >
                    ادمین
                  </button>
                  {!isSelf && (
                    <HoverButton
                      onClick={() => removeUser(u)}
                      aria-label="حذفِ کاربر"
                      styleStr="width:30px;height:30px;display:grid;place-items:center;border-radius:9px;cursor:pointer;color:rgba(255,160,160,.9);background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.28);"
                      hoverStr="background:rgba(255,80,80,.2);"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 7h14M10 7V5h4v2M9 7l.7 12h4.6L15 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </HoverButton>
                  )}
                </div>
              )
            })}
            {users.length === 0 && (
              <div style={css('text-align:center;padding:20px;color:rgba(245,250,255,.5);font-size:.86rem;')}>کاربری پیدا نشد.</div>
            )}
          </div>
        )}

        <div style={css('height:1px;background:rgba(255,255,255,.08);')} />
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
          <div style={css('font-size:.9rem;font-weight:800;color:#f3f8ff;')}>گزارشِ فعالیتِ ادمین</div>
          <span style={css('font-size:.7rem;color:rgba(245,250,255,.45);')}>{fa(audit.length)} رویداد اخیر</span>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:6px;max-height:34vh;overflow-y:auto;')}>
          {audit.map((e) => (
            <div
              key={e.id}
              style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 11px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);')}
            >
              <span style={css('flex:1;min-width:150px;font-size:.8rem;color:#eaf2ff;')} dir="auto">
                <span style={css('color:rgba(245,250,255,.6);')}>{e.actor || '—'}</span>
                {' · '}
                {auditText(e)}
                {e.target && (
                  <>
                    {' → '}
                    <span style={css('color:#9ecbff;')} dir="auto">
                      {e.target}
                    </span>
                  </>
                )}
              </span>
              <span style={css('flex:none;font-size:.68rem;color:rgba(245,250,255,.42);')}>{fa(timeFa(e.createdAt))}</span>
            </div>
          ))}
          {audit.length === 0 && (
            <div style={css('text-align:center;padding:16px;color:rgba(245,250,255,.45);font-size:.82rem;')}>
              هنوز رویدادی ثبت نشده.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
