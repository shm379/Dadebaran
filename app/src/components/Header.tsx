import { css } from '../css'
import { HoverButton } from './ui/HoverButton'
import { ModelPicker } from './ModelPicker'
import { UsageIndicator } from './UsageIndicator'
import { cfg } from '../config'
import { useChat } from '../state/ChatProvider'
import { useTasks } from '../state/TasksProvider'

type HeaderProps = {
  onToggleSidebar: () => void
  onNewChat: () => void
  onOpenTasks: () => void
  onOpenVoice: () => void
  onOpenPlans: () => void
}

export function Header({ onToggleSidebar, onNewChat, onOpenTasks, onOpenVoice, onOpenPlans }: HeaderProps) {
  const { activeBot } = useChat()
  const { tasks, faDigits } = useTasks()
  const botName = cfg[activeBot].name
  const taskCount = tasks.length

  return (
    <header style={css('flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 22px;backdrop-filter:blur(14px) saturate(180%);background:linear-gradient(180deg,rgba(10,13,24,.96),rgba(10,13,24,.8));border-bottom:1px solid rgba(255,255,255,.07);position:relative;z-index:20;')}>
      <div style={css('display:flex;align-items:center;gap:12px;')}>
        <div style={css('width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 40px rgba(22,122,254,.4);')}>
          <img src="/assets/logo-mark-dark.svg" alt="MR.CHATGPT" style={css('width:24px;height:24px;')} />
        </div>
        <div style={css('display:flex;flex-direction:column;line-height:1.25;')}>
          <strong style={css('font-size:1.05rem;font-weight:700;')}>{botName}</strong>
          <span style={css('font-size:.6rem;letter-spacing:.16em;color:rgba(245,250,255,.5);direction:ltr;text-align:right;')}>
            MR.CHATGPT &middot; GPT
          </span>
        </div>
      </div>
      <div style={css('display:flex;align-items:center;gap:10px;')}>
        <UsageIndicator onOpenPlans={onOpenPlans} />
        <ModelPicker />
        <HoverButton
          onClick={onOpenPlans}
          title="اشتراک و پلن‌ها"
          aria-label="اشتراک"
          styleStr="width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,196,64,.5);background:rgba(255,196,64,.12);color:#ffd884;cursor:pointer;"
          hoverStr="border-color:rgba(255,196,64,.9);background:rgba(255,196,64,.22);color:#fff;"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 8l4 3 4-5 4 5 4-3-1.5 10.5h-13L4 8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </HoverButton>
        <HoverButton
          onClick={onOpenTasks}
          title="کارهای زمان‌بندی‌شده"
          aria-label="کارهای زمان‌بندی‌شده"
          styleStr="position:relative;width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.04);color:#dce8ff;cursor:pointer;"
          hoverStr="border-color:rgba(255,255,255,.45);"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeWidth="1.9" />
            <path d="M12 8.5v4.2l2.6 1.6M9 3.2l-2.4 1.6M15 3.2l2.4 1.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          {taskCount > 0 && (
            <span style={css('position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:99px;background:#167afe;color:#fff;font-size:.62rem;font-weight:700;border:1.5px solid #101424;')}>
              {faDigits(taskCount)}
            </span>
          )}
        </HoverButton>
        <HoverButton
          onClick={onOpenVoice}
          title="گفت‌وگوی صوتی"
          aria-label="گفت‌وگوی صوتی"
          styleStr="width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(22,122,254,.55);background:rgba(22,122,254,.16);color:#bcd9ff;cursor:pointer;"
          hoverStr="border-color:rgba(22,122,254,.9);background:rgba(22,122,254,.28);color:#fff;"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 11v2M8 7.5v9M12 4.5v15M16 7.5v9M20 11v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </HoverButton>
        <HoverButton
          onClick={onToggleSidebar}
          title="پنل کناری"
          styleStr="width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.04);color:#dce8ff;cursor:pointer;"
          hoverStr="border-color:rgba(255,255,255,.45);"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </HoverButton>
        <HoverButton
          onClick={onNewChat}
          styleStr="display:inline-flex;align-items:center;gap:7px;padding:.62rem 1.05rem;border-radius:12px;font-weight:600;font-size:.88rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);"
          hoverStr="filter:brightness(1.06);transform:translateY(-1px);"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          گفت‌وگوی جدید
        </HoverButton>
      </div>
    </header>
  )
}
