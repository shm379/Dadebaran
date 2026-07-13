import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { css } from './css'

// Several hover states override only `border-color` while the base uses the
// `border` shorthand. Mixing shorthand + longhand for the same value makes
// React warn (and can be flaky), so when both are present we expand the base
// shorthand into width/style and let the hover's `border-color` win.
function normalizeBorder(style: CSSProperties): CSSProperties {
  if (style.border && style.borderColor) {
    const m = String(style.border).match(/^(\S+)\s+(\S+)\s+(.+)$/)
    if (m) {
      const { border, ...rest } = style
      void border
      return { ...rest, borderWidth: m[1], borderStyle: m[2] }
    }
  }
  return style
}

type HoverButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & {
  /** Base CSS declaration string (as in the source prototype). */
  styleStr: string
  /** CSS applied on hover, merged over the base (the source's `style-hover`). */
  hoverStr?: string
  children?: ReactNode
}

/**
 * A <button> that merges an extra style string on hover — replicating the
 * prototype's `style` + `style-hover` attribute pair, which the design runtime
 * turned into a generated :hover rule.
 */
export function HoverButton({
  styleStr,
  hoverStr,
  children,
  disabled,
  ...rest
}: HoverButtonProps) {
  const [hover, setHover] = useState(false)
  const style = normalizeBorder({
    ...css(styleStr),
    ...(hover && hoverStr && !disabled ? css(hoverStr) : {}),
  })
  return (
    <button
      {...rest}
      disabled={disabled}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  )
}
