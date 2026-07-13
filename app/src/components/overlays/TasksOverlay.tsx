import { css } from '../../css'
import { HoverButton } from '../ui/HoverButton'
import { cfg, ORDER } from '../../config'
import { useTasks } from '../../state/TasksProvider'
import { useToast } from '../../state/ToastProvider'
import type { Repeat, Task } from '../../types'

const REPEAT_OPTIONS: { v: Repeat; l: string }[] = [
  { v: 'once', l: 'یک‌بار' },
  { v: 'daily', l: 'روزانه' },
  { v: 'hourly', l: 'هر ساعت' },
  { v: 'weekly', l: 'هفتگی' },
]
const REPEAT_LABEL: Record<Repeat, string> = { once: 'یک‌بار', daily: 'روزانه', hourly: 'هر ساعت', weekly: 'هفتگی' }

function repeatStyle(active: boolean) {
  return (
    'flex:1;padding:.42rem .2rem;border-radius:9px;font-size:.76rem;font-weight:600;cursor:pointer;border:1px solid ' +
    (active ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.12)') +
    ';background:' +
    (active ? 'rgba(22,122,254,.22)' : 'transparent') +
    ';color:' +
    (active ? '#fff' : 'rgba(245,250,255,.66)') +
    ';'
  )
}

function TaskCard({ t }: { t: Task }) {
  const { toggleTask, deleteTask, runTask, faDigits, formatNext } = useTasks()
  const scheduleLabel = (REPEAT_LABEL[t.repeat] || t.repeat) + (t.repeat === 'hourly' ? '' : ' · ' + faDigits(t.time))
  const toggleStyle =
    'position:relative;width:38px;height:22px;border-radius:99px;cursor:pointer;border:1px solid ' +
    (t.enabled ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.2)') +
    ';background:' +
    (t.enabled ? 'rgba(22,122,254,.5)' : 'rgba(255,255,255,.08)') +
    ';transition:all .18s ease;'
  const knobStyle =
    'position:absolute;top:2px;' +
    (t.enabled ? 'left:2px' : 'right:2px') +
    ';width:16px;height:16px;border-radius:50%;background:#fff;transition:all .18s ease;'
  return (
    <div style={css('background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:15px;padding:13px 14px;display:flex;flex-direction:column;gap:10px;')}>
      <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:10px;')}>
        <div style={css('display:flex;flex-direction:column;gap:4px;min-width:0;')}>
          <div style={css('display:flex;align-items:center;gap:7px;')}>
            <span style={css('font-size:.66rem;font-weight:700;padding:.16rem .5rem;border-radius:99px;background:rgba(22,122,254,.22);border:1px solid rgba(22,122,254,.4);color:#bcd9ff;')}>
              {cfg[t.botId] ? cfg[t.botId].name : t.botId}
            </span>
            <span style={css('font-size:.72rem;color:rgba(245,250,255,.5);')}>{scheduleLabel}</span>
          </div>
          <div style={css('font-size:.9rem;color:#eaf2ff;line-height:1.6;')}>{t.input}</div>
        </div>
        <button onClick={() => toggleTask(t.id)} aria-label="فعال/خاموش" style={css(toggleStyle)}>
          <span style={css(knobStyle)} />
        </button>
      </div>
      <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;')}>
        <span style={css('font-size:.74rem;color:rgba(245,250,255,.55);')}>
          اجرای بعدی: {t.enabled ? formatNext(t.nextRun) : 'خاموش'}
        </span>
        <HoverButton
          onClick={() => runTask(t.id)}
          styleStr="margin-right:auto;display:inline-flex;align-items:center;gap:5px;padding:.32rem .7rem;border-radius:9px;font-size:.76rem;font-weight:600;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);"
          hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);"
        >
          {t.status === 'running' ? 'در حال اجرا…' : 'همین حالا اجرا کن'}
        </HoverButton>
        <HoverButton
          onClick={() => deleteTask(t.id)}
          aria-label="حذف"
          styleStr="width:30px;height:30px;display:grid;place-items:center;border-radius:9px;cursor:pointer;color:rgba(255,160,160,.9);background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.28);"
          hoverStr="background:rgba(255,80,80,.2);"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 7h14M10 7V5h4v2M9 7l.7 12h4.6L15 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </HoverButton>
      </div>
      {t.lastResult && (
        <div style={css('background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:11px 12px;')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;')}>
            <strong style={css('font-size:.82rem;font-weight:700;color:#eaf2ff;')}>{t.lastResult.title}</strong>
            <CopyResult text={t.lastResult.prompt} />
          </div>
          <div style={css('font-size:.84rem;line-height:1.8;color:rgba(245,250,255,.82);white-space:pre-wrap;max-height:150px;overflow:auto;')}>
            {t.lastResult.prompt}
          </div>
        </div>
      )}
    </div>
  )
}

function CopyResult({ text }: { text: string }) {
  const { copy } = useToast()
  return (
    <HoverButton
      onClick={() => copy(text, 'کپی شد ✓')}
      styleStr="display:inline-flex;align-items:center;gap:5px;padding:.28rem .6rem;border-radius:8px;font-size:.72rem;font-weight:600;cursor:pointer;color:#eaf2ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);"
      hoverStr="background:rgba(255,255,255,.2);"
    >
      کپی
    </HoverButton>
  )
}

export function TasksOverlay({ onClose }: { onClose: () => void }) {
  const { tasks, draft, setDraft, addTask } = useTasks()

  return (
    <div style={css('position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto;background:radial-gradient(circle at 50% 0%,rgba(22,122,254,.18),transparent 55%),rgba(8,10,20,.86);backdrop-filter:blur(16px);')}>
      <div style={css('position:relative;width:min(560px,96vw);padding:26px 22px;border-radius:24px;background:rgba(15,17,32,.74);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;gap:18px;')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;')}>
          <div style={css('display:flex;align-items:center;gap:11px;')}>
            <div style={css('width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);color:#9ecbff;')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeWidth="1.9" />
                <path d="M12 8.5v4.2l2.6 1.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </div>
            <div style={css('display:flex;flex-direction:column;line-height:1.3;')}>
              <strong style={css('font-size:1.05rem;font-weight:800;')}>کارهای زمان‌بندی‌شده</strong>
              <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>دستیارها به‌صورتِ خودکار برات کار می‌کنن</span>
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

        <div style={css('background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:13px;')}>
          <div style={css('font-size:.78rem;font-weight:600;color:rgba(245,250,255,.7);')}>کارِ جدید</div>
          <div style={css('display:flex;flex-wrap:wrap;gap:6px;')}>
            {ORDER.map((id) => {
              const active = draft.botId === id
              return (
                <button
                  key={id}
                  onClick={() => setDraft('botId', id)}
                  style={css('position:relative;padding:.4rem .7rem;border-radius:10px;font-size:.78rem;font-weight:600;cursor:pointer;color:#eef5ff;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);')}
                >
                  {active && (
                    <span style={css('position:absolute;inset:-1px;border-radius:10px;border:1px solid rgba(22,122,254,.75);background:rgba(22,122,254,.28);pointer-events:none;')} />
                  )}
                  <span style={css('position:relative;z-index:1;')}>{cfg[id].name}</span>
                </button>
              )
            })}
          </div>
          <textarea
            value={draft.input}
            onChange={(e) => setDraft('input', e.target.value)}
            rows={2}
            placeholder="چه کاری انجام بشه؟ مثلاً «۳ تا هوکِ اینستاگرام درباره‌ی هوش مصنوعی»"
            style={css('width:100%;box-sizing:border-box;resize:none;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:12px;color:#f7fbff;font-family:inherit;font-size:.92rem;line-height:1.7;padding:10px 12px;outline:none;')}
          />
          <div style={css('display:flex;gap:6px;')}>
            {REPEAT_OPTIONS.map((r) => (
              <button key={r.v} onClick={() => setDraft('repeat', r.v)} style={css(repeatStyle(draft.repeat === r.v))}>
                {r.l}
              </button>
            ))}
          </div>
          <div style={css('display:flex;align-items:center;gap:12px;')}>
            {draft.repeat === 'hourly' ? (
              <span style={css('font-size:.78rem;color:rgba(245,250,255,.5);')}>از همین حالا هر ساعت اجرا می‌شه</span>
            ) : (
              <div style={css('display:flex;align-items:center;gap:8px;')}>
                <span style={css('font-size:.8rem;color:rgba(245,250,255,.7);')}>ساعت</span>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft('time', e.target.value)}
                  style={css('background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:10px;color:#f7fbff;font-family:inherit;font-size:.9rem;padding:6px 10px;outline:none;')}
                />
              </div>
            )}
            <HoverButton
              onClick={addTask}
              styleStr="margin-right:auto;display:inline-flex;align-items:center;gap:7px;padding:.55rem 1.1rem;border-radius:12px;font-weight:600;font-size:.86rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);"
              hoverStr="filter:brightness(1.06);"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              افزودن
            </HoverButton>
          </div>
        </div>

        {tasks.length > 0 ? (
          <div style={css('display:flex;flex-direction:column;gap:11px;')}>
            {tasks.map((t) => (
              <TaskCard key={t.id} t={t} />
            ))}
          </div>
        ) : (
          <div style={css('text-align:center;padding:18px 10px;color:rgba(245,250,255,.5);font-size:.86rem;line-height:1.8;')}>
            هنوز کاری زمان‌بندی نکردی.
            <br />
            یه کارِ تکرارشونده بساز تا دستیار خودش هر روز برات انجامش بده.
          </div>
        )}
      </div>
    </div>
  )
}
