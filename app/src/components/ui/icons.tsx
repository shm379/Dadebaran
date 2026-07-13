import { css } from '../../css'
import type { BotId } from '../../config'

// Per-assistant glyphs, shared between the sidebar and the tasks picker.
export function BotIcon({ id }: { id: BotId }) {
  switch (id) {
    case 'prompt':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )
    case 'formal':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M6 3h8l4 4v14H6V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 12h6M9 16h6M9 8h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    case 'insta':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="6.5" width="17" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="13" r="3.1" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 6.5l1.2-2h5.6L16 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      )
    case 'english':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 12h17M12 3.5c2.4 2.3 2.4 14.7 0 17M12 3.5c-2.4 2.3-2.4 14.7 0 17" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'study':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M12 4L2.5 9 12 14l9.5-5L12 4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 11.2V15c0 1.1 2.7 2.4 6 2.4s6-1.3 6-2.4v-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

// The three bouncing dots used for loading / thinking states.
export function DotsLoader({ size = 7, color = '#60b0ff' }: { size?: number; color?: string }) {
  const dot = (delay: string) =>
    css(
      `width:${size}px;height:${size}px;border-radius:99px;background:${color};animation:mrcDot 1.2s ${delay} infinite;`,
    )
  return (
    <span style={css('display:inline-flex;gap:5px;align-items:flex-end;')}>
      <span style={dot('0s')} />
      <span style={dot('.2s')} />
      <span style={dot('.4s')} />
    </span>
  )
}
