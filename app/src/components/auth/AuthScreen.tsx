import { useState, type ReactNode } from 'react'
import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { auth, ApiError } from '../../api'
import type { User } from '../../types'

const PAGE_BG =
  'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;' +
  "font-family:'Vazirmatn',Tahoma,sans-serif;color:#f7fbff;" +
  'background:radial-gradient(circle at 18% -10%,rgba(22,122,254,.34),transparent 46%),' +
  'radial-gradient(circle at 84% 116%,rgba(22,122,254,.2),transparent 56%),#101424;'

const CARD =
  'width:min(420px,100%);box-sizing:border-box;padding:28px 26px;border-radius:24px;' +
  'background:rgba(15,17,32,.72);border:1px solid rgba(255,255,255,.12);' +
  'box-shadow:0 24px 80px rgba(7,17,47,.55);backdrop-filter:blur(16px);' +
  'display:flex;flex-direction:column;gap:18px;'

const FIELD_WRAP = 'display:flex;flex-direction:column;gap:6px;'
const LABEL = 'font-size:.8rem;font-weight:600;color:rgba(245,250,255,.72);'
const INPUT =
  'width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);' +
  'border-radius:12px;color:#f7fbff;font-family:inherit;font-size:.95rem;line-height:1.7;padding:11px 13px;outline:none;'

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label style={css(FIELD_WRAP)}>
      <span style={css(LABEL)}>{label}</span>
      {children}
    </label>
  )
}

export default function AuthScreen({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isLogin = mode === 'login'

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const user = isLogin
        ? await auth.login({ identifier: identifier.trim(), password })
        : await auth.register({
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            name: name.trim() || undefined,
            password,
          })
      onAuthed(user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطایی رخ داد. دوباره امتحان کن.')
    } finally {
      setBusy(false)
    }
  }

  const tab = (m: 'login' | 'register', label: string) => {
    const active = mode === m
    return (
      <button
        type="button"
        onClick={() => switchMode(m)}
        style={css(
          'flex:1;padding:.6rem;border-radius:11px;font-size:.9rem;font-weight:700;cursor:pointer;transition:all .18s ease;border:1px solid ' +
            (active ? 'rgba(22,122,254,.7)' : 'transparent') +
            ';background:' +
            (active ? 'rgba(22,122,254,.22)' : 'transparent') +
            ';color:' +
            (active ? '#fff' : 'rgba(245,250,255,.6)') +
            ';',
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div dir="rtl" style={css(PAGE_BG)}>
      <form onSubmit={submit} style={css(CARD)}>
        <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;')}>
          <div style={css('width:56px;height:56px;display:grid;place-items:center;border-radius:16px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 40px rgba(22,122,254,.4);')}>
            <img src="/assets/logo-mark-dark.svg" alt="MR.CHATGPT" style={css('width:30px;height:30px;')} />
          </div>
          <strong style={css('font-size:1.2rem;font-weight:800;')}>دستیارهای MR.CHATGPT</strong>
          <span style={css('font-size:.82rem;color:rgba(245,250,255,.6);line-height:1.7;')}>
            {isLogin ? 'برای ادامه وارد حسابت شو' : 'یه حساب بساز و شروع کن'}
          </span>
        </div>

        <div style={css('display:flex;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:4px;')}>
          {tab('login', 'ورود')}
          {tab('register', 'ثبت‌نام')}
        </div>

        {isLogin ? (
          <Field label="ایمیل یا شماره تلفن">
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com یا 0912…"
              autoComplete="username"
              dir="ltr"
              style={{ ...css(INPUT), textAlign: 'right' }}
            />
          </Field>
        ) : (
          <>
            <Field label="نام (اختیاری)">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی" autoComplete="name" style={css(INPUT)} />
            </Field>
            <Field label="ایمیل">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" dir="ltr" style={{ ...css(INPUT), textAlign: 'right' }} />
            </Field>
            <Field label="شماره تلفن">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09121234567" type="tel" autoComplete="tel" dir="ltr" style={{ ...css(INPUT), textAlign: 'right' }} />
            </Field>
          </>
        )}

        <Field label="رمز عبور">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            style={css(INPUT)}
          />
        </Field>

        {!isLogin && (
          <div style={css('font-size:.72rem;color:rgba(245,250,255,.5);line-height:1.7;margin-top:-6px;')}>
            حداقل یکی از ایمیل یا شماره تلفن را وارد کن.
          </div>
        )}

        {error && (
          <div style={css('padding:11px 13px;border-radius:12px;background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.4);color:#ffd6d6;font-size:.85rem;line-height:1.7;')}>
            {error}
          </div>
        )}

        <HoverButton
          type="submit"
          disabled={busy}
          styleStr={
            'width:100%;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:.8rem;border-radius:13px;font-weight:700;font-size:.95rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);' +
            (busy ? 'opacity:.7;cursor:default;' : '')
          }
          hoverStr="filter:brightness(1.06);transform:translateY(-1px);"
        >
          {busy ? 'کمی صبر کن…' : isLogin ? 'ورود' : 'ثبت‌نام و ورود'}
        </HoverButton>

        <div style={css('text-align:center;font-size:.82rem;color:rgba(245,250,255,.6);')}>
          {isLogin ? (
            <>
              حساب نداری؟{' '}
              <button type="button" onClick={() => switchMode('register')} style={css('background:none;border:0;cursor:pointer;color:#60b0ff;font-weight:700;font-family:inherit;font-size:.82rem;')}>
                ثبت‌نام کن
              </button>
            </>
          ) : (
            <>
              قبلاً ثبت‌نام کردی؟{' '}
              <button type="button" onClick={() => switchMode('login')} style={css('background:none;border:0;cursor:pointer;color:#60b0ff;font-weight:700;font-family:inherit;font-size:.82rem;')}>
                وارد شو
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
