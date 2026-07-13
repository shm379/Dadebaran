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
    res = await fetch(path, { credentials: 'include', ...init })
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
      const data = await request('/api/auth/me')
      return (data.user as User) ?? null
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

export const billing = {
  async plans(): Promise<Plan[]> {
    const data = await request('/api/plans')
    return (data.plans as Plan[]) || []
  },
  async status(): Promise<SubscriptionStatus> {
    return (await request('/api/subscription')) as unknown as SubscriptionStatus
  },
  async checkout(plan: string): Promise<SubscriptionStatus> {
    return (await request('/api/subscription/checkout', postInit({ plan }))) as unknown as SubscriptionStatus
  },
  async cancel(): Promise<SubscriptionStatus> {
    return (await request('/api/subscription/cancel', postInit({}))) as unknown as SubscriptionStatus
  },
}

export const claude = {
  async complete({ messages, model }: { messages: Message[]; model?: string }): Promise<string> {
    let res: Response
    try {
      res = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages, model }),
      })
    } catch {
      throw new ApiError('offline', 'اتصال به سرور قطع شد.')
    }
    if (res.status === 503) throw new ApiError('no-api', '')
    if (res.status === 401) throw new ApiError('unauthenticated', '')
    const data = (await res.json().catch(() => ({}))) as { text?: string; message?: string; error?: string }
    if (res.status === 402) throw new ApiError('quota_exceeded', data.message || '')
    if (!res.ok) throw new ApiError((data.error as string) || 'server', data.message || '')
    if (typeof data.text !== 'string') throw new ApiError('server', '')
    return data.text
  },
}

export type { User } from './types'
