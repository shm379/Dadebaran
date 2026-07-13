/**
 * Backend API client, grouped by concern: auth, models, billing, and the model
 * completion. All calls are same-origin and send the session cookie.
 *
 * `claude.complete` mirrors the prototype's `window.claude.complete` contract
 * (content may be a string or Anthropic content blocks) and is proxied through
 * `/api/complete` (auth-gated, routed to NabuGate server-side). Errors are
 * thrown as `ApiError` with a stable `code` so the UI can react (show the
 * Persian preview fallback, an upgrade prompt on quota, etc.).
 */
import type { ModelOption, Plan, SubscriptionStatus, User } from './types'

// Base URL of the backend. Empty = same-origin (the server serves the SPA and
// the API together). Set VITE_API_BASE_URL at build time to point the design at
// a separately-hosted backend, e.g. https://api.example.com — then the backend
// needs CORS_ORIGIN set to this frontend's origin and COOKIE_SAMESITE=none.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
function apiUrl(path: string): string {
  return API_BASE + path
}

export type TextBlock = { type: 'text'; text: string }
export type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}
export type ContentBlock = TextBlock | ImageBlock
export type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(apiUrl(path), { credentials: 'include', ...init })
  } catch {
    throw new ApiError('offline', 'اتصال به سرور برقرار نشد. اینترنت یا سرور را بررسی کن.')
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const code =
      res.status === 401
        ? 'unauthenticated'
        : res.status === 402
          ? 'quota_exceeded'
          : (data.error as string) || 'error'
    throw new ApiError(code, (data.message as string) || 'خطایی رخ داد. دوباره امتحان کن.')
  }
  return data
}

function postInit(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const auth = {
  async register(payload: { email?: string; phone?: string; name?: string; password: string }): Promise<User> {
    return (await request('/api/auth/register', postInit(payload))).user as User
  },
  async login(payload: { identifier: string; password: string }): Promise<User> {
    return (await request('/api/auth/login', postInit(payload))).user as User
  },
  async logout(): Promise<void> {
    await request('/api/auth/logout', postInit({}))
  },
  async me(): Promise<User | null> {
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      if (!res.ok) return null
      const data = (await res.json().catch(() => ({}))) as { user?: User }
      return data.user ?? null
    } catch {
      return null
    }
  },
}

export const models = {
  async list(): Promise<ModelOption[]> {
    const data = await request('/api/models')
    return (data.models as ModelOption[]) || []
  },
}

// checkout may either activate immediately (manual/demo) or return a payment
// gateway URL to redirect the browser to (Zibal).
export type CheckoutResult = Partial<SubscriptionStatus> & { checkoutUrl?: string; activated?: boolean }

export const billing = {
  async plans(): Promise<Plan[]> {
    const data = await request('/api/plans')
    return (data.plans as Plan[]) || []
  },
  async status(): Promise<SubscriptionStatus> {
    return (await request('/api/subscription')) as unknown as SubscriptionStatus
  },
  async checkout(plan: string): Promise<CheckoutResult> {
    return (await request('/api/subscription/checkout', postInit({ plan }))) as unknown as CheckoutResult
  },
  async cancel(): Promise<SubscriptionStatus> {
    return (await request('/api/subscription/cancel', postInit({}))) as unknown as SubscriptionStatus
  },
}

export const claude = {
  async complete({ messages, model }: { messages: Message[]; model?: string }): Promise<string> {
    let res: Response
    try {
      res = await fetch(apiUrl('/api/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages, model }),
      })
    } catch {
      throw new ApiError('offline', 'اتصال به سرور قطع شد.')
    }
    if (res.status === 401) throw new ApiError('unauthenticated', '')
    const data = (await res.json().catch(() => ({}))) as { text?: string; message?: string; error?: string }
    // Only a real "no gateway configured" is 'no-api'; other 503s (e.g. DB
    // outage) are transient, not the permanent preview message.
    if (res.status === 503) throw new ApiError(data.error === 'no-api' ? 'no-api' : 'offline', data.message || '')
    if (res.status === 402) throw new ApiError('quota_exceeded', data.message || '')
    if (!res.ok) throw new ApiError((data.error as string) || 'server', data.message || '')
    if (typeof data.text !== 'string') throw new ApiError('server', '')
    return data.text
  },
}

export type { User } from './types'
