import { useState, type ReactNode } from 'react'
import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { auth, ApiError } from '../../api'
import { useToast } from '../../state/ToastProvider'
import type { User } from '../../types'

const LABEL = 'font-size:.8rem;font-weight:600;color:rgba(245,250,255,.72);'
const INPUT =
  'width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);' +
  'border-radius:12px;color:#f7fbff;font-family:inherit;font-size:.95rem;line-height:1.7;padding:11px 13px;outline:none;'
const CARD = 'background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;'

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label style={css('display:flex;flex-direction:column;gap:6px;')}>
      <span style={css(LABEL)}>{label}</span>
      {children}
    </label>
  )
}

export function SettingsOverlay({
  user,
  onClose,
  onUpdated,
}: {
  user: User
  onClose: () => void
  onUpdated: (u: User) => void
}) {
  const { showToast } = useToast()
  const [name, setName] = useState(user.name || '')
  const [email, setEmail] = useState(user.email || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (savingProfile) return
    setSavingProfile(true)
    try {
      const updated = await auth.updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() })
      onUpdated(updated)
      showToast('پروفایل به‌روزرسانی شد ✓')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'ذخیره نشد؛ دوباره امتحان کن.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (savingPassword) return
    setSavingPassword(true)
    try {
      await auth.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      showToast('رمز عبور تغییر کرد ✓')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'تغییر نشد؛ دوباره امتحان کن.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div style={css('position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto;background:radial-gradient(circle at 50% 0%,rgba(22,122,254,.18),transparent 55%),rgba(8,10,20,.86);backdrop-filter:blur(16px);')}>
      <div style={css('position:relative;width:min(520px,96vw);padding:26px 22px;border-radius:24px;background:rgba(15,17,32,.78);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;gap:18px;')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;')}>
          <div style={css('display:flex;align-items:center;gap:11px;')}>
            <div style={css('width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);color:#9ecbff;')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div style={css('display:flex;flex-direction:column;line-height:1.3;')}>
              <strong style={css('font-size:1.05rem;font-weight:800;')}>حسابِ کاربری</strong>
              <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>پروفایل و رمز عبور</span>
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

        <form onSubmit={saveProfile} style={css(CARD)}>
          <div style={css('font-size:.82rem;font-weight:700;color:rgba(245,250,255,.8);')}>پروفایل</div>
          <Field label="نام">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نامت" style={css(INPUT)} />
          </Field>
          <Field label="ایمیل">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" dir="ltr" style={{ ...css(INPUT), textAlign: 'right' }} />
          </Field>
          <Field label="شماره تلفن">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="09121234567" dir="ltr" style={{ ...css(INPUT), textAlign: 'right' }} />
          </Field>
          <HoverButton
            type="submit"
            disabled={savingProfile}
            styleStr={
              'align-self:flex-start;display:inline-flex;align-items:center;gap:7px;padding:.6rem 1.2rem;border-radius:12px;font-weight:700;font-size:.86rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);' +
              (savingProfile ? 'opacity:.7;' : '')
            }
            hoverStr="filter:brightness(1.06);"
          >
            {savingProfile ? 'در حال ذخیره…' : 'ذخیره‌ی پروفایل'}
          </HoverButton>
        </form>

        <form onSubmit={savePassword} style={css(CARD)}>
          <div style={css('font-size:.82rem;font-weight:700;color:rgba(245,250,255,.8);')}>تغییر رمز عبور</div>
          <Field label="رمز فعلی">
            <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" autoComplete="current-password" style={css(INPUT)} />
          </Field>
          <Field label="رمز جدید">
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="حداقل ۶ کاراکتر" style={css(INPUT)} />
          </Field>
          <HoverButton
            type="submit"
            disabled={savingPassword}
            styleStr={
              'align-self:flex-start;display:inline-flex;align-items:center;gap:7px;padding:.6rem 1.2rem;border-radius:12px;font-weight:700;font-size:.86rem;cursor:pointer;color:#eaf2ff;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.08);' +
              (savingPassword ? 'opacity:.7;' : '')
            }
            hoverStr="background:rgba(255,255,255,.16);"
          >
            {savingPassword ? 'در حال تغییر…' : 'تغییر رمز'}
          </HoverButton>
        </form>
      </div>
    </div>
  )
}
