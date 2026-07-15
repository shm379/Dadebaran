import { useEffect, useState } from 'react'
import { css } from './css'
import { DotsLoader } from './components/ui/icons'
import { auth } from './api'
import App from './App'
import AuthScreen from './components/auth/AuthScreen'
import type { User } from './types'

type Status = 'loading' | 'authed' | 'anon'

// Decides between the auth screen and the app based on the session cookie.
export default function AppRoot() {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let alive = true
    auth.me().then((u) => {
      if (!alive) return
      setUser(u)
      setStatus(u ? 'authed' : 'anon')
    })
    return () => {
      alive = false
    }
  }, [])

  async function logout() {
    try {
      await auth.logout()
    } catch {
      /* ignore — clear locally regardless */
    }
    setUser(null)
    setStatus('anon')
  }

  if (status === 'loading') {
    return (
      <div
        dir="rtl"
        style={css(
          "min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Vazirmatn',Tahoma,sans-serif;color:#f7fbff;background:radial-gradient(circle at 18% -10%,rgba(22,122,254,.34),transparent 46%),#101424;",
        )}
      >
        <DotsLoader size={9} />
      </div>
    )
  }

  if (status === 'anon' || !user) {
    return (
      <AuthScreen
        onAuthed={(u) => {
          setUser(u)
          setStatus('authed')
        }}
      />
    )
  }

  return <App authUser={user} onLogout={logout} onUserUpdate={setUser} />
}
