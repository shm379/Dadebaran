import { css } from '../css'
import { AssistantList } from './AssistantList'
import { SettingsPanel } from './SettingsPanel'
import { AccountFooter } from './AccountFooter'
import type { User } from '../types'

export function Sidebar({
  user,
  onLogout,
  onOpenSettings,
}: {
  user?: User
  onLogout?: () => void
  onOpenSettings?: () => void
}) {
  return (
    <aside style={css('grid-row:1;min-height:0;overflow-y:auto;border-right:1px solid rgba(255,255,255,.07);background:rgba(15,15,29,.4);backdrop-filter:blur(14px);padding:20px 18px;display:flex;flex-direction:column;gap:22px;')}>
      <AssistantList />
      <div style={css('height:1px;background:rgba(255,255,255,.08);')} />
      <SettingsPanel />
      <AccountFooter user={user} onLogout={onLogout} onOpenSettings={onOpenSettings} />
    </aside>
  )
}
