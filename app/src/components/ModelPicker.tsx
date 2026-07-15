import { useEffect, useRef, useState } from 'react'
import { css } from '../css'
import { useChat } from '../state/ChatProvider'
import type { ModelOption } from '../types'

export function ModelPicker({ onOpenPlans }: { onOpenPlans: () => void }) {
  const { model, models, setModel } = useChat()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const current = models.find((m) => m.id === model)
  const label = current ? current.label : model || 'مدل'

  // Ungrouped (curated aliases) first, then one section per provider group,
  // so a multi-model provider's long catalog stays organized.
  const ungrouped = models.filter((m) => !m.group)
  const groups: string[] = []
  for (const m of models) if (m.group && !groups.includes(m.group)) groups.push(m.group)

  const renderItem = (m: ModelOption) => {
    const active = m.id === model
    const locked = m.allowed === false
    return (
      <button
        key={m.id}
        onClick={() => {
          if (locked) {
            setOpen(false)
            onOpenPlans()
            return
          }
          setModel(m.id)
          setOpen(false)
        }}
        title={locked ? 'برای دسترسی اشتراک بگیر' : undefined}
        style={css(
          'display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:right;padding:9px 11px;border-radius:10px;cursor:pointer;font-size:.85rem;font-weight:600;border:0;background:' +
            (active ? 'rgba(22,122,254,.24)' : 'transparent') +
            ';color:' +
            (locked ? 'rgba(245,250,255,.55)' : '#eaf2ff') +
            ';',
        )}
      >
        <span style={css('overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{m.label}</span>
        {locked ? (
          <span style={css('flex:none;display:inline-flex;align-items:center;gap:4px;font-size:.66rem;color:#ffd884;')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            {m.requiredPlan === 'business' ? 'سازمانی' : 'حرفه‌ای'}
          </span>
        ) : (
          active && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={css('flex:none;color:#60b0ff;')}>
              <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        )}
      </button>
    )
  }

  const groupHeader = (text: string) => (
    <div
      key={'h-' + text}
      style={css('padding:8px 11px 4px;font-size:.68rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(180,205,255,.55);')}
    >
      {text}
    </div>
  )

  return (
    <div ref={ref} style={css('position:relative;')}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="انتخابِ مدل"
        style={css('display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.04);color:#dce8ff;cursor:pointer;font-size:.82rem;font-weight:600;max-width:170px;')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={css('flex:none;')}>
          <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" />
          <circle cx="15" cy="10" r="1.4" fill="currentColor" />
          <path d="M9 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span style={css('overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={css('flex:none;opacity:.7;')}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={css('position:absolute;top:48px;right:0;z-index:40;min-width:200px;max-height:280px;overflow-y:auto;padding:6px;border-radius:14px;background:rgba(16,19,34,.98);border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(7,17,47,.6);display:flex;flex-direction:column;gap:2px;')}>
          {models.length === 0 && (
            <div style={css('padding:10px 12px;font-size:.8rem;color:rgba(245,250,255,.5);')}>مدلی در دسترس نیست</div>
          )}
          {ungrouped.map(renderItem)}
          {groups.map((g) => (
            <div key={'g-' + g} style={css('display:flex;flex-direction:column;gap:2px;')}>
              {groupHeader(g)}
              {models.filter((m) => m.group === g).map(renderItem)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
