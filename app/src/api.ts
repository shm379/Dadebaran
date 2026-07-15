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
import type {
  AdminAnalytics,
  AdminStats,
  AdminUser,
  ApiKey,
  Conversation,
  ConvSummary,
  ModelOption,
  Plan,
  SubscriptionStatus,
  User,
} from './types'

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
  async updateProfile(payload: { name?: string; email?: string; phone?: string }): Promise<User> {
    const data = await request('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return data.user as User
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await request('/api/auth/password', postInit(payload))
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

export const conversations = {
  async list(): Promise<ConvSummary[]> {
    return ((await request('/api/conversations')).conversations as ConvSummary[]) || []
  },
  async get(id: string): Promise<Conversation> {
    return (await request('/api/conversations/' + id)).conversation as Conversation
  },
  async create(payload: { botId: string; title?: string; messages: unknown[] }): Promise<{ id: string }> {
    return (await request('/api/conversations', postInit(payload))) as unknown as { id: string }
  },
  async update(id: string, payload: { title?: string; messages?: unknown[] }): Promise<void> {
    await request('/api/conversations/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  async remove(id: string): Promise<void> {
    await request('/api/conversations/' + id, { method: 'DELETE' })
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
  async reconcile(): Promise<SubscriptionStatus & { reconciled: boolean }> {
    return (await request('/api/subscription/reconcile', postInit({}))) as unknown as SubscriptionStatus & {
      reconciled: boolean
    }
  },
}

export const keys = {
  async list(): Promise<ApiKey[]> {
    return ((await request('/api/keys')).keys as ApiKey[]) || []
  },
  async create(name: string): Promise<{ key: string; meta: ApiKey }> {
    return (await request('/api/keys', postInit({ name }))) as unknown as { key: string; meta: ApiKey }
  },
  async revoke(id: string): Promise<void> {
    await request('/api/keys/' + id, { method: 'DELETE' })
  },
}

export const admin = {
  async stats(): Promise<AdminStats> {
    return (await request('/api/admin/stats')) as unknown as AdminStats
  },
  async analytics(days = 14): Promise<AdminAnalytics> {
    return (await request('/api/admin/analytics?days=' + days)) as unknown as AdminAnalytics
  },
  async users(query = ''): Promise<AdminUser[]> {
    const q = query ? '?query=' + encodeURIComponent(query) : ''
    return ((await request('/api/admin/users' + q)).users as AdminUser[]) || []
  },
  async updateUser(id: string, patch: { plan?: string; isAdmin?: boolean }): Promise<void> {
    await request('/api/admin/users/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  },
  async deleteUser(id: string): Promise<void> {
    await request('/api/admin/users/' + id, { method: 'DELETE' })
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
