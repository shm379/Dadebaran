import { css } from '../css'
import { cfg } from '../config'
import { useChat } from '../state/ChatProvider'

export function SettingsPanel() {
  const { activeBot, settings, setSetting } = useChat()
  const botSettings = settings[activeBot]
  const fields = cfg[activeBot].fields

  return (
    <div>
      <div style={css('font-size:.7rem;letter-spacing:.04em;color:rgba(245,250,255,.5);margin-bottom:12px;font-weight:600;')}>
        تنظیمات خروجی
      </div>
      <div style={css('display:flex;flex-direction:column;gap:17px;')}>
        {fields.map((f, fi) => (
          <div key={fi}>
            <div style={css('font-size:.78rem;color:rgba(245,250,255,.72);margin-bottom:8px;font-weight:600;')}>{f.label}</div>
            <div style={css('display:flex;flex-wrap:wrap;gap:7px;')}>
              {f.options.map((o, oi) => {
                const active = botSettings[f.key] === o.v
                return (
                  <button
                    key={oi}
                    onClick={() => setSetting(f.key, o.v)}
                    style={css('position:relative;padding:.44rem .7rem;border-radius:11px;font-size:.8rem;font-weight:600;cursor:pointer;color:#eef5ff;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);')}
                  >
                    {active && (
                      <span style={css('position:absolute;inset:-1px;border-radius:11px;border:1px solid rgba(22,122,254,.75);background:rgba(22,122,254,.28);pointer-events:none;')} />
                    )}
                    <span style={css('position:relative;z-index:1;')}>{o.l || o.v}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
