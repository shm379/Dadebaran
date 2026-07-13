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

export type BotState = {
  messages: Msg[]
  settings: Record<string, string>
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

export type AppState = {
  activeBot: BotId
  bots: Record<BotId, BotState>
  input: string
  pendingImage: ImageData | null
  listening: boolean
  voiceMode: boolean
  voiceState: VoiceState
  voiceTranscript: string
  voiceReply: string
  speakReplies: boolean
  tasksOpen: boolean
  tasks: Task[]
  taskDraft: TaskDraft
  busy: boolean
  showSidebar: boolean
  toast: string
}
