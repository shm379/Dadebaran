import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { billing } from '../api'
import type { SubscriptionStatus } from '../types'

type BillingStore = {
  status: SubscriptionStatus | null
  refresh: () => Promise<void>
  setStatus: (s: SubscriptionStatus) => void
}

const Ctx = createContext<BillingStore | null>(null)

export function useBilling(): BillingStore {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBilling must be used within BillingProvider')
  return c
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await billing.status())
    } catch {
      /* ignore — keep last known status */
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <Ctx.Provider value={{ status, refresh, setStatus }}>{children}</Ctx.Provider>
}
