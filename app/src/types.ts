import type { BotId } from './config'

export type ImageData = {
  dataURL: string
  mediaType: string
  base64: string
  isVideo?: boolean
}

export type Msg = {
  id: number
  role: 'user' | 'assistant'
  kind: 'text' | 'loading' | 'error' | 'prompt'
  text?: string
  image?: string | null
  loadingText?: string
  title?: string
  prompt?: string
  tips?: string[]
  copyLabel?: string
  copyToast?: string
  promptLang?: 'fa' | 'en'
  sourceIdea?: string
}

export type Settings = Record<string, string>

export type BotState = {
  messages: Msg[]
  settings: Settings
}

export type Repeat = 'once' | 'daily' | 'hourly' | 'weekly'

export type Task = {
  id: string
  botId: BotId
  input: string
  repeat: Repeat
  time: string
  enabled: boolean
  lastRun: number | null
  lastResult: { title: string; prompt: string } | null
  status: 'idle' | 'running' | 'done' | 'error'
  nextRun: number
}

export type TaskDraft = {
  botId: BotId
  input: string
  repeat: Repeat
  time: string
}

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

// ---- Auth / billing / models ----

export type User = { id: string; email: string | null; phone: string | null; name: string | null; isAdmin?: boolean }

export type ModelOption = {
  id: string
  label: string
  group?: string
  allowed?: boolean
  requiredPlan?: string | null
}

export type ApiKey = {
  id: string
  name: string
  prefix: string
  revoked: boolean
  lastUsedAt: string | null
  createdAt: string
}

export type AdminUser = {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  isAdmin: boolean
  createdAt: string
  plan: string
  today: number
}

export type AdminStats = {
  users: number
  byPlan: Record<string, number>
  messagesToday: number
  apiKeys: number
  conversations: number
}

export type PlanLimits = { dailyMessages: number | null }

export type Plan = {
  code: string
  name: string
  price: number
  currency: string
  priceLabel: string
  period: string
  limits: PlanLimits
  features: string[]
}

export type UsageInfo = { used: number; limit: number | null; remaining: number | null }

export type ConvSummary = { id: string; botId: BotId; title: string; updatedAt: string; messageCount: number }
export type Conversation = { id: string; botId: BotId; title: string; messages: Msg[]; updatedAt: string }

export type SubscriptionStatus = {
  plan: Plan
  subscription: {
    planCode: string
    status: string
    provider: string
    currentPeriodEnd: string | null
  } | null
  usage: UsageInfo
}
