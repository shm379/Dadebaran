import type { CSSProperties } from 'react'

const cache = new Map<string, CSSProperties>()

function toCamel(prop: string): string {
  const p = prop.trim()
  if (p.startsWith('--')) return p // CSS custom property — keep as-is
  // -webkit-foo -> WebkitFoo ; foo-bar -> fooBar
  return p
    .replace(/^-ms-/, 'ms-')
    .replace(/^-(webkit|moz|o)-/, (_, v) => v[0].toUpperCase() + v.slice(1) + '-')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Parse a plain CSS declaration string ("prop:val;prop:val") into a React
 * style object. Mirrors the inline-style strings used by the source prototype
 * so the visual output stays identical.
 */
export function css(str: string): CSSProperties {
  if (!str) return {}
  const hit = cache.get(str)
  if (hit) return hit
  const out: Record<string, string> = {}
  for (const decl of str.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const key = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (!key) continue
    out[toCamel(key)] = val
  }
  const frozen = out as CSSProperties
  cache.set(str, frozen)
  return frozen
}
