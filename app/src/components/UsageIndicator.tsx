import { useEffect, useRef } from 'react'
import { css } from '../css'
import { useBilling } from '../state/BillingProvider'
import { useChat } from '../state/ChatProvider'

const FA = '۰۱۲۳۴۵۶۷۸۹'
const faDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => FA[+d])

export function UsageIndicator({ onOpenPlans }: { onOpenPlans: () => void }) {
  const { status, refresh } = useBilling()
  const { busy } = useChat()
  const prevBusy = useRef(busy)

  // Refresh the counter when a completion finishes (busy true -> false).
  useEffect(() => {
    if (prevBusy.current && !busy) refresh()
    prevBusy.current = busy
  }, [busy, refresh])

  if (!status) return null
  const { limit, remaining } = status.usage
  const unlimited = limit == null

  const low = !unlimited && (remaining ?? 0) <= 3
  const border = unlimited ? 'rgba(22,122,254,.5)' : low ? 'rgba(255,120,120,.5)' : 'rgba(255,255,255,.2)'
  const bg = unlimited ? 'rgba(22,122,254,.14)' : low ? 'rgba(255,120,120,.12)' : 'rgba(255,255,255,.04)'
  const color = unlimited ? '#bcd9ff' : low ? '#ffc9c9' : '#dce8ff'

  return (
    <button
      onClick={onOpenPlans}
      title="پلن و مصرف"
      style={css(
        'display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 12px;border-radius:12px;cursor:pointer;font-size:.8rem;font-weight:600;border:1px solid ' +
          border +
          ';background:' +
          bg +
          ';color:' +
          color +
          ';',
      )}
    >
      {unlimited ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 8l4 3 4-5 4 5 4-3-1.5 10.5h-13L4 8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          {status.plan.name}
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {faDigits(remaining ?? 0)} از {faDigits(limit ?? 0)}
        </>
      )}
    </button>
  )
}
