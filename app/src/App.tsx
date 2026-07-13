import { useState } from 'react'
import { css } from './css'
import { ToastProvider } from './state/ToastProvider'
import { ChatProvider, useChat } from './state/ChatProvider'
import { TasksProvider } from './state/TasksProvider'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { Composer } from './components/Composer'
import { TasksOverlay } from './components/overlays/TasksOverlay'
import { VoiceOverlay } from './components/overlays/VoiceOverlay'
import { PlansOverlay } from './components/overlays/PlansOverlay'
import type { User } from './types'

export type AppProps = { authUser?: User; onLogout?: () => void }

type Overlay = 'tasks' | 'voice' | 'plans' | null

const PAGE =
  "height:100vh;display:flex;flex-direction:column;overflow:hidden;font-family:'Vazirmatn',Tahoma,sans-serif;color:#f7fbff;" +
  'background:radial-gradient(circle at 18% -10%,rgba(22,122,254,.34),transparent 46%),' +
  'radial-gradient(circle at 84% 116%,rgba(22,122,254,.2),transparent 56%),#101424;'

function Shell({ authUser, onLogout }: AppProps) {
  const { newChat } = useChat()
  const [showSidebar, setShowSidebar] = useState(true)
  const [overlay, setOverlay] = useState<Overlay>(null)

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
        {showSidebar && <Sidebar user={authUser} onLogout={onLogout} />}
      </div>

      {overlay === 'tasks' && <TasksOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'voice' && <VoiceOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'plans' && <PlansOverlay onClose={() => setOverlay(null)} />}
    </div>
  )
}

export default function App({ authUser, onLogout }: AppProps) {
  return (
    <ToastProvider>
      <ChatProvider>
        <TasksProvider>
          <Shell authUser={authUser} onLogout={onLogout} />
        </TasksProvider>
      </ChatProvider>
    </ToastProvider>
  )
}
