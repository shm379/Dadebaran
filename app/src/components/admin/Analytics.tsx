import { useEffect, useState } from 'react'
import { css } from '../../css'
import { admin } from '../../api'
import type { AdminAnalytics } from '../../types'

const FA = '۰۱۲۳۴۵۶۷۸۹'
const fa = (s: string | number) => String(s).replace(/[0-9]/g, (d) => FA[+d])
const md = (day: string) => fa(day.slice(5)) // MM-DD

// Rial → Toman (÷10) with Persian thousands separators, e.g. "۱٬۲۵۰٬۰۰۰".
const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
const toman = (rial: number) => fa(grp(rial / 10))

const BAR = 'linear-gradient(180deg,#2488ff,#1460ca)'
const GOLD = 'linear-gradient(180deg,#f7c948,#d99e0b)'

// Build a CSV of the day-series (BOM + English headers so it imports cleanly).
function toCSV(d: AdminAnalytics): string {
  const m = Object.fromEntries(d.messagesByDay.map((p) => [p.day, p.count]))
  const u = Object.fromEntries(d.newUsersByDay.map((p) => [p.day, p.count]))
  const r = Object.fromEntries(d.revenueByDay.map((p) => [p.day, p.amount]))
  const lines = [['day', 'messages', 'new_users', 'revenue_toman']]
  for (const p of d.messagesByDay) {
    lines.push([p.day, String(m[p.day] || 0), String(u[p.day] || 0), String(Math.round((r[p.day] || 0) / 10))])
  }
  return lines.map((row) => row.join(',')).join('\n')
}

function downloadCSV(d: AdminAnalytics) {
  const blob = new Blob(['﻿' + toCSV(d)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mrchatgpt-analytics-${d.days}d.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={css('flex:1;min-width:96px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:3px;')}>
      <span style={css('font-size:1.25rem;font-weight:800;color:#f3f8ff;')}>{value}</span>
      <span style={css('font-size:.7rem;color:rgba(245,250,255,.55);')}>{label}</span>
    </div>
  )
}

// Single-series magnitude over time — one hue, thin bars anchored to a baseline,
// only the peak is directly labeled; every bar has a hover title.
type BarPoint = { day: string; value: number }
function Bars({
  data,
  fill = BAR,
  fmt = (v: number) => fa(v),
  peakColor = '#9ecbff',
}: {
  data: BarPoint[]
  fill?: string
  fmt?: (v: number) => string
  peakColor?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const peak = data.reduce((mi, d, i, a) => (d.value > a[mi].value ? i : mi), 0)
  return (
    <div>
      <div style={css('display:flex;align-items:flex-end;gap:2px;height:96px;padding-top:14px;')}>
        {data.map((d, i) => (
          <div
            key={d.day}
            title={`${d.day}: ${fmt(d.value)}`}
            style={css('flex:1;min-width:0;height:100%;display:flex;align-items:flex-end;position:relative;')}
          >
            <div
              style={css(
                'width:100%;border-radius:4px 4px 0 0;background:' +
                  fill +
                  ';height:' +
                  (d.value ? Math.max(3, (d.value / max) * 100) : 1) +
                  '%;' +
                  (d.value ? '' : 'opacity:.35;'),
              )}
            />
            {i === peak && d.value > 0 && (
              <span style={css('position:absolute;top:-13px;left:50%;transform:translateX(-50%);font-size:.6rem;font-weight:700;color:' + peakColor + ';white-space:nowrap;')}>
                {fmt(d.value)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={css('display:flex;justify-content:space-between;margin-top:5px;font-size:.62rem;color:rgba(245,250,255,.42);')}>
        <span>{md(data[0]?.day || '')}</span>
        {data.length > 6 && <span>{md(data[Math.floor(data.length / 2)]?.day || '')}</span>}
        <span>{md(data[data.length - 1]?.day || '') || 'امروز'}</span>
      </div>
    </div>
  )
}

function HBars({ items }: { items: { label: string; value: number }[] }) {
  if (!items.length) return <div style={css('font-size:.78rem;color:rgba(245,250,255,.4);padding:6px 2px;')}>داده‌ای نیست.</div>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div style={css('display:flex;flex-direction:column;gap:7px;')}>
      {items.map((it, i) => (
        <div key={i} style={css('display:flex;align-items:center;gap:8px;')}>
          <span
            style={css('flex:none;width:38%;font-size:.78rem;color:rgba(245,250,255,.82);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}
            dir="auto"
            title={it.label}
          >
            {it.label}
          </span>
          <div style={css('flex:1;height:10px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden;')}>
            <div style={css('height:100%;border-radius:99px;background:' + BAR + ';width:' + (it.value / max) * 100 + '%;')} />
          </div>
          <span style={css('flex:none;font-size:.76rem;font-weight:600;color:rgba(245,250,255,.7);min-width:26px;text-align:left;')}>
            {fa(it.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={css('display:flex;flex-direction:column;gap:9px;padding:14px;border-radius:16px;background:rgba(8,12,24,.4);border:1px solid rgba(255,255,255,.08);')}>
      <div style={css('font-size:.8rem;font-weight:700;color:rgba(245,250,255,.75);')}>{title}</div>
      {children}
    </div>
  )
}

export function Analytics() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    admin
      .analytics(days)
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [days])

  return (
    <div style={css('display:flex;flex-direction:column;gap:12px;')}>
      <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;')}>
        <div style={css('font-size:.9rem;font-weight:800;color:#f3f8ff;')}>تحلیلِ مصرف</div>
        <div style={css('display:flex;gap:4px;align-items:center;')}>
          {[7, 14, 30].map((n) => {
            const on = days === n
            return (
              <button
                key={n}
                onClick={() => setDays(n)}
                style={css(
                  'padding:.3rem .6rem;border-radius:9px;font-size:.74rem;font-weight:600;cursor:pointer;border:1px solid ' +
                    (on ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.14)') +
                    ';background:' +
                    (on ? 'rgba(22,122,254,.22)' : 'transparent') +
                    ';color:' +
                    (on ? '#fff' : 'rgba(245,250,255,.6)') +
                    ';',
                )}
              >
                {fa(n)} روز
              </button>
            )
          })}
          <button
            onClick={() => data && downloadCSV(data)}
            disabled={!data}
            title="دانلود گزارش CSV"
            style={css(
              'display:flex;align-items:center;gap:5px;padding:.3rem .6rem;border-radius:9px;font-size:.74rem;font-weight:600;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:rgba(245,250,255,.72);' +
                (data ? 'cursor:pointer;' : 'opacity:.5;cursor:default;'),
            )}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={css('text-align:center;padding:24px;color:rgba(245,250,255,.5);')}>در حال بارگذاری…</div>
      ) : data ? (
        <>
          <div style={css('display:flex;flex-wrap:wrap;gap:10px;')}>
            <Tile label={`پیام (${fa(days)} روز)`} value={fa(data.totalMessages)} />
            <Tile label="فعال امروز" value={fa(data.activeToday)} />
            <Tile label="فعال این هفته" value={fa(data.activeWeek)} />
            <Tile label={`درآمد (${fa(days)} روز) تومان`} value={toman(data.totalRevenue)} />
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:12px;')}>
            <Section title="پیام در روز">
              <Bars data={data.messagesByDay.map((d) => ({ day: d.day, value: d.count }))} />
            </Section>
            <Section title="کاربرِ جدید در روز">
              <Bars data={data.newUsersByDay.map((d) => ({ day: d.day, value: d.count }))} />
            </Section>
          </div>
          <div style={css('display:grid;grid-template-columns:1fr;gap:12px;')}>
            <Section title="درآمد در روز (تومان)">
              <Bars
                data={data.revenueByDay.map((d) => ({ day: d.day, value: d.amount }))}
                fill={GOLD}
                fmt={toman}
                peakColor="#ffd884"
              />
            </Section>
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:12px;')}>
            <Section title="مدل‌های پرکاربرد">
              <HBars items={data.topModels.map((m) => ({ label: m.model, value: m.count }))} />
            </Section>
            <Section title="کاربرانِ پرمصرف">
              <HBars items={data.topUsers.map((u) => ({ label: u.label, value: u.count }))} />
            </Section>
          </div>
        </>
      ) : (
        <div style={css('text-align:center;padding:20px;color:rgba(245,250,255,.5);')}>داده‌ای در دسترس نیست.</div>
      )}
    </div>
  )
}
