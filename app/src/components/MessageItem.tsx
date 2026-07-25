import { css } from '../css'
import { HoverButton } from './ui/HoverButton'
import { DotsLoader } from './ui/icons'
import { cfg } from '../config'
import { useChat } from '../state/ChatProvider'
import { useToast } from '../state/ToastProvider'
import type { Msg } from '../types'

export function MessageItem({ m, isLast }: { m: Msg; isLast: boolean }) {
  const { activeBot, refine } = useChat()
  const { copy } = useToast()

  if (m.role === 'user' && m.kind === 'text') {
    const hasText = !!(m.text && m.text.trim())
    return (
      <div style={css('display:flex;justify-content:flex-start;')}>
        <div style={css('max-width:82%;padding:12px 16px;border-radius:18px 18px 6px 18px;font-size:.96rem;line-height:1.7;color:#fff;background:linear-gradient(180deg,#2488ff,#1460ca);border:1px solid #167afe;box-shadow:inset 0 0 40px rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px;')}>
          {m.image && (
            <img src={m.image} alt="تصویر پیوست" style={css('display:block;max-width:240px;max-height:240px;border-radius:11px;border:1px solid rgba(255,255,255,.25);')} />
          )}
          {hasText && <div>{m.text}</div>}
        </div>
      </div>
    )
  }

  if (m.kind === 'loading') {
    // While streaming, show the answer as it's written; the dots stay as the
    // "still going" signal.
    const streamed = m.text && m.text.trim()
    return (
      <div style={css('display:flex;flex-direction:column;gap:9px;')}>
        <div style={css('display:flex;align-items:center;gap:11px;color:rgba(245,250,255,.7);font-size:.9rem;')}>
          <DotsLoader />
          {m.loadingText}
        </div>
        {streamed && (
          <div
            dir="auto"
            style={css('white-space:pre-wrap;padding:12px 15px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:rgba(240,247,255,.86);font-size:.92rem;line-height:1.9;')}
          >
            {m.text}
            <span style={css('display:inline-block;width:7px;height:1.05em;margin-right:2px;vertical-align:-2px;border-radius:1px;background:rgba(140,190,255,.75);')} />
          </div>
        )}
      </div>
    )
  }

  if (m.kind === 'error') {
    return (
      <div style={css('display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:14px;background:rgba(255,176,31,.1);border:1px solid rgba(255,176,31,.4);color:#ffe2ad;font-size:.92rem;line-height:1.7;')}>
        {m.text}
      </div>
    )
  }

  // prompt card
  const promptDir = m.promptLang === 'en' ? 'ltr' : 'rtl'
  const promptAlign = m.promptLang === 'en' ? 'left' : 'right'
  const hasTips = !!(m.tips && m.tips.length)
  return (
    <div style={css('background:rgba(22,122,254,.1);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:inset 0 0 64px rgba(21,21,29,.4);padding:16px 17px;')}>
      <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px;')}>
        <div style={css('display:flex;align-items:center;gap:10px;min-width:0;')}>
          <div style={css('flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:rgba(22,122,254,.22);border:1px solid rgba(255,255,255,.14);')}>
            <img src="/assets/logo-mark-dark.svg" alt="" style={css('width:17px;height:17px;')} />
          </div>
          <strong style={css('font-size:.98rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
            {m.title}
          </strong>
        </div>
        <HoverButton
          onClick={() => copy(m.prompt || '', m.copyToast)}
          styleStr="flex:none;display:inline-flex;align-items:center;gap:6px;padding:.42rem .75rem;border-radius:10px;font-size:.8rem;font-weight:600;cursor:pointer;color:#eaf2ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);"
          hoverStr="background:rgba(255,255,255,.2);"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {m.copyLabel || 'کپی'}
        </HoverButton>
      </div>
      <div
        dir={promptDir}
        style={{
          ...css('background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:15px 17px;white-space:pre-wrap;line-height:1.9;font-size:.95rem;color:#e8f1ff;'),
          textAlign: promptAlign as 'left' | 'right',
        }}
      >
        {m.prompt}
      </div>
      {hasTips && (
        <div style={css('margin-top:13px;display:flex;flex-direction:column;gap:7px;')}>
          {m.tips!.map((tip, i) => (
            <div key={i} style={css('display:flex;gap:8px;align-items:flex-start;font-size:.85rem;line-height:1.6;color:rgba(245,250,255,.78);')}>
              <span style={css('flex:none;margin-top:2px;color:#60b0ff;')}>✓</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
      {isLast && (
        <div style={css('margin-top:15px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:8px;')}>
          <span style={css('font-size:.78rem;color:rgba(245,250,255,.5);align-self:center;margin-left:2px;')}>اصلاح:</span>
          {cfg[activeBot].refines.map((r, i) => (
            <HoverButton
              key={i}
              onClick={() => refine(m, r)}
              styleStr="padding:.36rem .72rem;border-radius:99px;font-size:.8rem;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);"
              hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);"
            >
              {r.label}
            </HoverButton>
          ))}
        </div>
      )}
    </div>
  )
}
