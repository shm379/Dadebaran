import { css } from '../css'
import { BotIcon } from './ui/icons'
import { cfg, GROUPS, type BotId } from '../config'
import { useChat } from '../state/ChatProvider'

function BotButton({ id, active, onPick }: { id: BotId; active: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      style={css('position:relative;display:flex;align-items:center;gap:10px;text-align:right;padding:10px 11px;border-radius:13px;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);transition:all .18s ease;')}
    >
      {active && (
        <span style={css('position:absolute;inset:-1px;border-radius:13px;border:1px solid rgba(22,122,254,.7);background:rgba(22,122,254,.16);box-shadow:inset 0 0 30px rgba(22,122,254,.18);pointer-events:none;')} />
      )}
      <span style={css('position:relative;z-index:1;flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#9ecbff;')}>
        <BotIcon id={id} />
      </span>
      <span style={css('position:relative;z-index:1;display:flex;flex-direction:column;line-height:1.32;min-width:0;')}>
        <strong style={css('font-size:.9rem;font-weight:700;')}>{cfg[id].name}</strong>
        <span style={css('font-size:.7rem;color:rgba(245,250,255,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
          {cfg[id].tagline}
        </span>
      </span>
    </button>
  )
}

export function AssistantList() {
  const { activeBot, switchBot } = useChat()
  return (
    <div style={css('display:flex;flex-direction:column;gap:18px;')}>
      {GROUPS.map((g, gi) => (
        <div key={gi}>
          <div style={css('font-size:.7rem;letter-spacing:.04em;color:rgba(245,250,255,.5);margin-bottom:10px;font-weight:600;')}>
            {g.label}
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px;')}>
            {g.ids.map((id) => (
              <BotButton key={id} id={id} active={id === activeBot} onPick={() => switchBot(id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
