import { css } from '../css'
import { HoverButton } from './ui/HoverButton'
import type { User } from '../types'

export function AccountFooter({ user, onLogout }: { user?: User; onLogout?: () => void }) {
  const label = user ? user.name || user.email || user.phone || 'حساب من' : ''
  return (
    <div style={css('margin-top:auto;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);')}>
      {user && (
        <div style={css('display:flex;align-items:center;gap:9px;margin-bottom:14px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);')}>
          <span style={css('flex:none;width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:rgba(22,122,254,.22);border:1px solid rgba(255,255,255,.14);color:#bcd9ff;font-weight:700;font-size:.9rem;')}>
            {(label[0] || '؟').toUpperCase()}
          </span>
          <span style={css('flex:1;min-width:0;font-size:.82rem;color:#eaf2ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')} title={label} dir="auto">
            {label}
          </span>
          <HoverButton
            onClick={() => onLogout && onLogout()}
            aria-label="خروج"
            title="خروج از حساب"
            styleStr="flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);"
            hoverStr="background:rgba(255,80,80,.18);border-color:rgba(255,80,80,.5);color:#ffd0d0;"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 12H4m0 0l3.5-3.5M4 12l3.5 3.5M14 5.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </HoverButton>
        </div>
      )}
      <p style={css('margin:0 0 12px;font-size:.78rem;line-height:1.75;color:rgba(245,250,255,.6);')}>
        دستیارت رو از بالا عوض کن؛ هر کدوم تنظیمات و گفت‌وگوی خودش رو داره.
      </p>
      <div style={css('display:flex;gap:9px;')}>
        <span style={css('width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);')}>
          <img src="/assets/telegram.svg" alt="تلگرام" style={css('width:18px;height:18px;')} />
        </span>
        <span style={css('width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);')}>
          <img src="/assets/instagram.svg" alt="اینستاگرام" style={css('width:18px;height:18px;')} />
        </span>
      </div>
    </div>
  )
}
