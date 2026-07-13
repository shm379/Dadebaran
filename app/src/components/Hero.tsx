import { css } from '../css'
import { HoverButton } from './ui/HoverButton'
import { cfg } from '../config'
import { useChat } from '../state/ChatProvider'

export function Hero() {
  const { activeBot, runExample } = useChat()
  const c = cfg[activeBot]
  return (
    <div style={css('max-width:760px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 0 18px;')}>
      <div style={css('width:84px;height:84px;display:grid;place-items:center;border-radius:24px;background:rgba(22,122,254,.16);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 0 88px rgba(22,122,254,.3),0 24px 80px rgba(7,17,47,.35);')}>
        <img src="/assets/logo-mark-dark.svg" alt="" style={css('width:42px;height:42px;')} />
      </div>
      <h1 style={css('margin:22px 0 0;font-size:2.1rem;font-weight:800;line-height:1.28;color:#f3f8ff;')}>
        {c.heroPre}
        <span style={css('color:#60b0ff;')}>{c.heroAccent}</span>
        {c.heroPost}
      </h1>
      <p style={css('margin:14px 0 0;max-width:31rem;color:rgba(245,250,255,.78);font-size:1.02rem;line-height:1.75;')}>
        {c.heroSub}
      </p>
      <div style={css('margin-top:30px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:right;')}>
        {c.examples.map((ex, i) => (
          <HoverButton
            key={i}
            onClick={() => runExample(ex)}
            styleStr="display:flex;flex-direction:column;gap:8px;padding:15px 16px;border-radius:15px;cursor:pointer;text-align:right;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#eaf2ff;transition:all .2s ease;"
            hoverStr="background:rgba(22,122,254,.14);border-color:rgba(22,122,254,.6);transform:translateY(-2px);"
          >
            <span style={css('align-self:flex-start;font-size:.64rem;font-weight:700;padding:.2rem .5rem;border-radius:99px;background:rgba(22,122,254,.22);border:1px solid rgba(22,122,254,.4);color:#bcd9ff;')}>
              {ex.tag}
            </span>
            <span style={css('font-size:.92rem;line-height:1.65;')}>{ex.text}</span>
          </HoverButton>
        ))}
      </div>
    </div>
  )
}
