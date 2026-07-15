import { useEffect } from 'react'
import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { BotIcon } from '../ui/icons'
import { cfg, type BotId } from '../../config'
import { useChat } from '../../state/ChatProvider'

const FA = '۰۱۲۳۴۵۶۷۸۹'
const faDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => FA[+d])

function relTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const hm = faDigits(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2))
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'امروز ' + hm
  if (d.toDateString() === y.toDateString()) return 'دیروز ' + hm
  return faDigits(('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2)) + ' ' + hm
}

export function HistoryOverlay({ onClose }: { onClose: () => void }) {
  const { conversations, convId, refreshConversations, loadConversation, deleteConversation } = useChat()

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  return (
    <div style={css('position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto;background:radial-gradient(circle at 50% 0%,rgba(22,122,254,.18),transparent 55%),rgba(8,10,20,.86);backdrop-filter:blur(16px);')}>
      <div style={css('position:relative;width:min(560px,96vw);padding:26px 22px;border-radius:24px;background:rgba(15,17,32,.78);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;gap:16px;')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;')}>
          <div style={css('display:flex;align-items:center;gap:11px;')}>
            <div style={css('width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);color:#9ecbff;')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h11M4 18h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </div>
            <div style={css('display:flex;flex-direction:column;line-height:1.3;')}>
              <strong style={css('font-size:1.05rem;font-weight:800;')}>تاریخچه‌ی گفت‌وگوها</strong>
              <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>گفت‌وگوهای قبلیت رو دوباره باز کن</span>
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

        {conversations.length === 0 ? (
          <div style={css('text-align:center;padding:26px 10px;color:rgba(245,250,255,.5);font-size:.86rem;line-height:1.8;')}>
            هنوز گفت‌وگویی نداری.
            <br />
            یه پیام بفرست تا این‌جا ذخیره بشه.
          </div>
        ) : (
          <div style={css('display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto;')}>
            {conversations.map((c) => {
              const active = c.id === convId
              const botName = cfg[c.botId as BotId] ? cfg[c.botId as BotId].name : c.botId
              return (
                <div
                  key={c.id}
                  style={css(
                    'position:relative;display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:13px;border:1px solid ' +
                      (active ? 'rgba(22,122,254,.6)' : 'rgba(255,255,255,.1)') +
                      ';background:' +
                      (active ? 'rgba(22,122,254,.12)' : 'rgba(255,255,255,.03)') +
                      ';',
                  )}
                >
                  <button
                    onClick={() => {
                      loadConversation(c.id)
                      onClose()
                    }}
                    style={css('flex:1;min-width:0;display:flex;align-items:center;gap:11px;text-align:right;background:none;border:0;cursor:pointer;color:inherit;padding:0;')}
                  >
                    <span style={css('flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#9ecbff;')}>
                      <BotIcon id={c.botId as BotId} />
                    </span>
                    <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;')}>
                      <span style={css('font-size:.9rem;font-weight:600;color:#eaf2ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
                        {c.title}
                      </span>
                      <span style={css('font-size:.7rem;color:rgba(245,250,255,.5);')}>
                        {botName} · {relTime(c.updatedAt)} · {faDigits(c.messageCount)} پیام
                      </span>
                    </span>
                  </button>
                  <HoverButton
                    onClick={() => deleteConversation(c.id)}
                    aria-label="حذف"
                    styleStr="flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;cursor:pointer;color:rgba(255,160,160,.9);background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.28);"
                    hoverStr="background:rgba(255,80,80,.2);"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 7h14M10 7V5h4v2M9 7l.7 12h4.6L15 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </HoverButton>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
