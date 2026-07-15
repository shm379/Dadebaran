import { useEffect, useState } from 'react'
import { css } from './css'
import { ToastProvider, useToast } from './state/ToastProvider'
import { ChatProvider, useChat } from './state/ChatProvider'
import { TasksProvider } from './state/TasksProvider'
import { BillingProvider } from './state/BillingProvider'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { Composer } from './components/Composer'
import { TasksOverlay } from './components/overlays/TasksOverlay'
import { VoiceOverlay } from './components/overlays/VoiceOverlay'
import { PlansOverlay } from './components/overlays/PlansOverlay'
import { SettingsOverlay } from './components/overlays/SettingsOverlay'
import type { User } from './types'

export type AppProps = { authUser?: User; onLogout?: () => void; onUserUpdate?: (u: User) => void }

type Overlay = 'tasks' | 'voice' | 'plans' | 'settings' | null

const PAGE =
  "height:100vh;display:flex;flex-direction:column;overflow:hidden;font-family:'Vazirmatn',Tahoma,sans-serif;color:#f7fbff;" +
  'background:radial-gradient(circle at 18% -10%,rgba(22,122,254,.34),transparent 46%),' +
  'radial-gradient(circle at 84% 116%,rgba(22,122,254,.2),transparent 56%),#101424;'

function Shell({ authUser, onLogout, onUserUpdate }: AppProps) {
  const { newChat } = useChat()
  const { showToast } = useToast()
  const [showSidebar, setShowSidebar] = useState(true)
  const [overlay, setOverlay] = useState<Overlay>(null)

  // Handle the return from the Zibal payment gateway (?billing=success|failed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billing = params.get('billing')
    if (!billing) return
    showToast(billing === 'success' ? 'پرداخت موفق بود؛ اشتراکت فعال شد ✓' : 'پرداخت کامل نشد. دوباره امتحان کن.')
    if (billing === 'success') setOverlay('plans')
    params.delete('billing')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''))
  }, [showToast])

  const bodyGrid =
    'flex:1;min-height:0;display:grid;grid-template-columns:' +
    (showSidebar ? '300px minmax(0,1fr)' : 'minmax(0,1fr)') +
    ';'

  return (
    <div dir="rtl" style={css(PAGE)}>
      <Header
        onToggleSidebar={() => setShowSidebar((s) => !s)}
        onNewChat={newChat}
        onOpenTasks={() => setOverlay('tasks')}
        onOpenVoice={() => setOverlay('voice')}
        onOpenPlans={() => setOverlay('plans')}
      />
      <div style={css(bodyGrid)}>
        <main style={css('min-height:0;min-width:0;display:flex;flex-direction:column;')}>
          <ChatArea />
          <Composer />
        </main>
        {showSidebar && (
          <Sidebar user={authUser} onLogout={onLogout} onOpenSettings={() => setOverlay('settings')} />
        )}
      </div>

      {overlay === 'tasks' && <TasksOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'voice' && <VoiceOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'plans' && <PlansOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'settings' && authUser && (
        <SettingsOverlay
          user={authUser}
          onClose={() => setOverlay(null)}
          onUpdated={(u) => onUserUpdate && onUserUpdate(u)}
        />
      )}
    </div>
  )
}

export default function App({ authUser, onLogout, onUserUpdate }: AppProps) {
  return (
    <ToastProvider>
      <ChatProvider>
        <BillingProvider>
          <TasksProvider>
            <Shell authUser={authUser} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          </TasksProvider>
        </BillingProvider>
      </ChatProvider>
    </ToastProvider>
  )
}
