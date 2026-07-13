import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { DotsLoader } from '../ui/icons'
import { cfg } from '../../config'
import { useChat } from '../../state/ChatProvider'
import { useVoice } from '../../hooks/useVoice'

function voiceBtnStyle(s: string) {
  const c = s === 'listening' ? 'rgba(255,80,80,1)' : s === 'thinking' ? 'rgba(124,192,255,1)' : '#167afe'
  const bg = s === 'listening' ? 'linear-gradient(180deg,#ff6b6b,#d63a3a)' : 'linear-gradient(180deg,#2488ff,#1460ca)'
  const anim = s === 'listening' || s === 'speaking' ? 'animation:mrcPulse 1.4s ease-in-out infinite;' : ''
  return (
    'position:relative;width:108px;height:108px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#fff;border:1px solid ' +
    c +
    ';background:' +
    bg +
    ';box-shadow:0 14px 40px rgba(7,17,47,.5),inset 0 0 50px rgba(255,255,255,.12);' +
    anim
  )
}

function speakChipStyle(active: boolean) {
  return (
    'display:inline-flex;align-items:center;gap:6px;padding:.42rem .8rem;border-radius:99px;font-size:.78rem;font-weight:600;cursor:pointer;border:1px solid ' +
    (active ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.16)') +
    ';background:' +
    (active ? 'rgba(22,122,254,.22)' : 'rgba(255,255,255,.05)') +
    ';color:' +
    (active ? '#fff' : 'rgba(245,250,255,.6)') +
    ';'
  )
}

export function VoiceOverlay({ onClose }: { onClose: () => void }) {
  const { activeBot } = useChat()
  const v = useVoice()
  const botName = cfg[activeBot].name
  const vs = v.voiceState

  return (
    <div style={css('position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 28%,rgba(22,122,254,.22),transparent 60%),rgba(8,10,20,.86);backdrop-filter:blur(16px);')}>
      <div style={css('position:relative;width:min(520px,94vw);padding:30px 26px 26px;border-radius:26px;background:rgba(15,17,32,.72);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;')}>
        <HoverButton
          onClick={onClose}
          aria-label="بستن"
          styleStr="position:absolute;top:14px;left:14px;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);"
          hoverStr="background:rgba(255,255,255,.16);"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </HoverButton>
        <div style={css('display:flex;flex-direction:column;align-items:center;gap:6px;')}>
          <div style={css('width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 40px rgba(22,122,254,.4);')}>
            <img src="/assets/logo-mark-dark.svg" alt="" style={css('width:26px;height:26px;')} />
          </div>
          <strong style={css('font-size:1.05rem;font-weight:800;')}>گفت‌وگوی صوتی</strong>
          <span style={css('font-size:.74rem;color:rgba(245,250,255,.55);')}>با {botName}</span>
        </div>
        <div ref={v.setVizRef} style={css('height:90px;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;')} />
        {v.transcript && <div style={css('font-size:.95rem;color:#eaf2ff;line-height:1.7;')}>«{v.transcript}»</div>}
        {v.reply && (
          <div style={css('font-size:.95rem;color:rgba(245,250,255,.85);line-height:1.85;background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;max-height:170px;overflow:auto;width:100%;box-sizing:border-box;')}>
            {v.reply}
          </div>
        )}
        <button onClick={() => v.voiceTurn()} aria-label="شروع/پایانِ صحبت" style={css(voiceBtnStyle(vs))}>
          {vs === 'listening' && (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
            </svg>
          )}
          {vs === 'thinking' && <DotsLoader size={9} color="#fff" />}
          {vs === 'speaking' && (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path d="M16 8.5a4 4 0 0 1 0 7M18.6 6a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
          {vs === 'idle' && (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <div style={css('font-size:.82rem;color:rgba(245,250,255,.72);min-height:1.2em;')}>{v.statusText}</div>
        <button onClick={() => v.toggleSpeakReplies()} style={css(speakChipStyle(v.speakReplies))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          </svg>
          پاسخِ صوتی
        </button>
      </div>
    </div>
  )
}
