import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { css } from '../css'

type ToastCtx = {
  showToast: (t: string) => void
  copy: (text: string, toast?: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast must be used within ToastProvider')
  return c
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((t: string) => {
    setToast(t)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 1800)
  }, [])

  const copy = useCallback(
    (text: string, toastMsg?: string) => {
      try {
        navigator.clipboard.writeText(text)
      } catch {
        /* ignore */
      }
      showToast(toastMsg || 'کپی شد ✓')
    },
    [showToast],
  )

  return (
    <Ctx.Provider value={{ showToast, copy }}>
      {children}
      {toast && (
        <div
          style={css(
            'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:80;padding:.7rem 1.2rem;border-radius:13px;font-size:.88rem;font-weight:600;color:#eaffef;background:rgba(16,40,30,.92);border:1px solid rgba(16,185,129,.5);box-shadow:0 12px 28px rgba(6,24,66,.45);backdrop-filter:blur(10px);animation:mrcToast .25s ease both;',
          )}
        >
          {toast}
        </div>
      )}
    </Ctx.Provider>
  )
}
