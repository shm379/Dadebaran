import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cfg, ORDER, defaultSettings, type BotId } from '../config'
import { buildPrompt, parse, partialPrompt, type MediaKind } from '../prompts'
import { claude, models as modelsApi, conversations as convApi, ApiError, type Message } from '../api'
import type { ConvSummary, ImageData, ModelOption, Msg, Settings } from '../types'

type Example = { text: string; patch?: Record<string, string> }
type Refine = { label: string; mod: string; lang?: 'en' | 'fa' }

export type ChatStore = {
  activeBot: BotId
  settings: Record<BotId, Settings>
  messages: Msg[]
  convId: string | null
  conversations: ConvSummary[]
  model: string
  models: ModelOption[]
  busy: boolean
  resetToken: number
  switchBot: (id: BotId) => void
  setSetting: (key: string, value: string) => void
  setModel: (id: string) => void
  newChat: () => void
  stop: () => void
  send: (idea: string, image?: ImageData | null) => void
  runExample: (ex: Example) => void
  refine: (m: Msg, r: Refine) => void
  completeRaw: (messages: Message[]) => Promise<string>
  settingsFor: (botId: BotId) => Settings
  refreshConversations: () => Promise<void>
  loadConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
}

const Ctx = createContext<ChatStore | null>(null)

export function useChat(): ChatStore {
  const c = useContext(Ctx)
  if (!c) throw new Error('useChat must be used within ChatProvider')
  return c
}

function initialSettings(): Record<BotId, Settings> {
  const s = {} as Record<BotId, Settings>
  ORDER.forEach((id) => (s[id] = { ...defaultSettings[id] }))
  return s
}

function deriveTitle(messages: Msg[]): string {
  const first = messages.find((m) => m.role === 'user' && m.text && m.text.trim())
  return (first ? first.text!.trim() : 'گفت‌وگو').slice(0, 100)
}

const SETTINGS_KEY = 'mrc-settings-v1'
const MODEL_KEY = 'mrc-model'

// How much of the conversation travels with each request. Capped on both count
// and size so a long thread can't grow the payload (and the bill) without bound.
const HISTORY_MAX_MESSAGES = 8
const HISTORY_MAX_CHARS = 12000

/**
 * Turn the on-screen thread into prior turns for the model.
 *
 * Assistant turns are replayed as the JSON envelope they were parsed from, so
 * the model sees its own output contract and keeps answering in that shape.
 * Attached images are not replayed — re-uploading base64 on every follow-up
 * would dwarf the rest of the payload — so an image-only turn becomes a marker.
 */
function historyMessages(msgs: Msg[]): Message[] {
  const turns: Message[] = []
  for (const m of msgs) {
    if (m.role === 'user' && m.kind === 'text') {
      const text = (m.text || '').trim()
      if (text || m.image) turns.push({ role: 'user', content: text || '[تصویری فرستادم]' })
    } else if (m.role === 'assistant' && m.kind === 'prompt') {
      turns.push({
        role: 'assistant',
        content: JSON.stringify({ title: m.title || '', prompt: m.prompt || '', tips: m.tips || [] }),
      })
    }
  }
  const kept = turns.slice(-HISTORY_MAX_MESSAGES)
  let chars = kept.reduce((n, t) => n + String(t.content).length, 0)
  while (kept.length && chars > HISTORY_MAX_CHARS) {
    chars -= String(kept[0].content).length
    kept.shift()
  }
  // The exchange has to open on a user turn.
  while (kept.length && kept[0].role === 'assistant') kept.shift()
  return kept
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeBot, setActiveBot] = useState<BotId>('prompt')
  const [settings, setSettings] = useState<Record<BotId, Settings>>(initialSettings)
  const [messages, setMessages] = useState<Msg[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConvSummary[]>([])
  const [model, setModelState] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [busy, setBusy] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const uid = useRef(1)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  const settingsRef = useRef(settings)
  const modelRef = useRef(model)
  const busyRef = useRef(busy)
  const activeBotRef = useRef(activeBot)
  const convIdRef = useRef(convId)
  const skipSave = useRef(false)
  messagesRef.current = messages
  settingsRef.current = settings
  modelRef.current = model
  busyRef.current = busy
  activeBotRef.current = activeBot
  convIdRef.current = convId

  // ---- load settings/model (local) + history (server) ----
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
      if (saved) {
        const next = {} as Record<BotId, Settings>
        ORDER.forEach((id) => (next[id] = Object.assign({}, defaultSettings[id], saved[id] || {})))
        setSettings(next)
      }
      const savedModel = localStorage.getItem(MODEL_KEY)
      if (savedModel) setModelState(savedModel)
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await convApi.list())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  useEffect(() => {
    let alive = true
    modelsApi
      .list()
      .then((list) => {
        if (!alive) return
        setModels(list)
        // Keep the selection on a model the current plan is allowed to use.
        setModelState((cur) => {
          const isAllowed = (id: string) => list.some((m) => m.id === id && m.allowed !== false)
          if (cur && isAllowed(cur)) return cur
          const firstAllowed = list.find((m) => m.allowed !== false)
          return firstAllowed ? firstAllowed.id : list[0] ? list[0].id : cur
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // ---- persist settings / model ----
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings, loaded])

  useEffect(() => {
    if (loaded && model) {
      try {
        localStorage.setItem(MODEL_KEY, model)
      } catch {
        /* ignore */
      }
    }
  }, [model, loaded])

  // ---- autosave the current conversation to the server ----
  const saveCurrent = useCallback(async () => {
    const msgs = messagesRef.current
    if (!msgs.length) return
    const title = deriveTitle(msgs)
    try {
      if (!convIdRef.current) {
        const r = await convApi.create({ botId: activeBotRef.current, title, messages: msgs })
        convIdRef.current = r.id
        setConvId(r.id)
        refreshConversations()
      } else {
        await convApi.update(convIdRef.current, { title, messages: msgs })
      }
    } catch {
      /* ignore — keep the local copy */
    }
  }, [refreshConversations])

  useEffect(() => {
    if (busy || !messages.length) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const h = setTimeout(() => void saveCurrent(), 500)
    return () => clearTimeout(h)
  }, [messages, busy, saveCurrent])

  // ---- message helpers ----
  const pushMsg = useCallback((m: Omit<Msg, 'id'>): number => {
    const id = uid.current++
    setMessages((prev) => [...prev, { id, ...m }])
    return id
  }, [])

  const replaceMsg = useCallback((mid: number, patch: Omit<Msg, 'id'>) => {
    setMessages((prev) => prev.map((m) => (m.id === mid ? ({ id: mid, ...patch } as Msg) : m)))
  }, [])

  const completeRaw = useCallback((msgs: Message[]) => {
    return claude.complete({ messages: msgs, model: modelRef.current || undefined })
  }, [])

  const generate = useCallback(
    async (
      botId: BotId,
      idea: string,
      opts: {
        image?: ImageData | null
        settingsOverride?: Settings
        modifier?: string
        langOverride?: 'en' | 'fa'
        history?: Msg[]
      } = {},
    ) => {
      const s: Settings = { ...(opts.settingsOverride || settingsRef.current[botId]) }
      if (opts.langOverride) s.lang = opts.langOverride
      const loadingId = pushMsg({ role: 'assistant', kind: 'loading', loadingText: cfg[botId].loadingText })
      setBusy(true)
      const ac = new AbortController()
      abortRef.current = ac
      // Repaint on a timer rather than per token — a long answer is thousands
      // of deltas and each one would otherwise re-render the whole thread.
      let partial = ''
      let flushTimer: ReturnType<typeof setTimeout> | null = null
      const paint = () => {
        flushTimer = null
        replaceMsg(loadingId, {
          role: 'assistant',
          kind: 'loading',
          loadingText: cfg[botId].loadingText,
          text: partialPrompt(partial),
        })
      }
      try {
        const mediaKind: MediaKind = opts.image ? (opts.image.isVideo ? 'video' : 'image') : null
        const content = buildPrompt(botId, idea, s, opts.modifier, mediaKind)
        const message: Message = opts.image
          ? {
              role: 'user',
              content: [
                { type: 'image' as const, source: { type: 'base64' as const, media_type: opts.image.mediaType, data: opts.image.base64 } },
                { type: 'text' as const, text: content },
              ],
            }
          : { role: 'user', content }
        // Earlier turns give the model the context a follow-up depends on
        // ("کوتاه‌ترش کن"); the newest turn still carries the full instruction
        // scaffold so the answer keeps its expected shape.
        const raw = await claude.stream({
          messages: [...historyMessages(opts.history || []), message],
          model: modelRef.current || undefined,
          signal: ac.signal,
          onDelta: (chunk) => {
            partial += chunk
            if (flushTimer == null) flushTimer = setTimeout(paint, 60)
          },
        })
        if (flushTimer != null) clearTimeout(flushTimer)
        // Stopped before anything readable arrived — drop the placeholder
        // rather than leaving a card holding a JSON fragment.
        if (ac.signal.aborted && !partialPrompt(raw).trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== loadingId))
          return
        }
        const data = parse(raw)
        replaceMsg(loadingId, {
          role: 'assistant',
          kind: 'prompt',
          title: data.title,
          prompt: data.prompt,
          tips: data.tips,
          copyLabel: cfg[botId].resultLabel,
          copyToast: cfg[botId].copyToast,
          promptLang: botId === 'prompt' ? ((s.lang as 'fa' | 'en') || 'fa') : 'fa',
          sourceIdea: idea,
        })
      } catch (err) {
        if (flushTimer != null) clearTimeout(flushTimer)
        const code = err instanceof ApiError ? err.code : 'server'
        let msg: string
        if (code === 'no-api') msg = 'برای پاسخِ زنده باید سرورِ مدل (نبوگیت) متصل باشد؛ این‌جا فعلاً فقط پیش‌نمایشِ ظاهر است.'
        else if (code === 'quota_exceeded') msg = (err as ApiError).message || 'سقفِ پیام‌های امروزت پر شده. برای ادامه اشتراک تهیه کن.'
        else if (code === 'unauthenticated') msg = 'نشستت منقضی شده؛ دوباره وارد شو.'
        else if (code === 'offline') msg = 'اتصال به سرور قطع شد. چند لحظه بعد دوباره امتحان کن.'
        else if (opts.image) msg = 'نتونستم این تصویر رو پردازش کنم. یه عکسِ واضح‌تر و بزرگ‌تر (JPG یا PNG) بفرست و دوباره امتحان کن.'
        else msg = 'یه مشکلی پیش اومد. چند لحظه صبر کن و دوباره بفرست.'
        replaceMsg(loadingId, { role: 'assistant', kind: 'error', text: msg })
      } finally {
        if (abortRef.current === ac) abortRef.current = null
        setBusy(false)
      }
    },
    [pushMsg, replaceMsg],
  )

  // ---- public actions ----
  const switchBot = useCallback((id: BotId) => {
    setActiveBot((cur) => {
      if (id === cur) return cur
      setConvId(null)
      convIdRef.current = null
      setMessages([])
      setResetToken((t) => t + 1)
      return id
    })
  }, [])

  const setSetting = useCallback((key: string, value: string) => {
    const id = activeBotRef.current
    setSettings((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }, [])

  const setModel = useCallback((id: string) => setModelState(id), [])

  // Stop generating. Whatever already streamed in is kept.
  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setConvId(null)
    convIdRef.current = null
    setMessages([])
    setResetToken((t) => t + 1)
  }, [])

  const send = useCallback(
    (idea: string, image?: ImageData | null) => {
      const text = (idea || '').trim()
      if ((!text && !image) || busyRef.current) return
      const bot = activeBotRef.current
      // Snapshot before pushing, so this turn isn't replayed as its own history.
      const history = messagesRef.current
      pushMsg({ role: 'user', kind: 'text', text, image: image ? image.dataURL : null })
      generate(bot, text, { image, history })
    },
    [pushMsg, generate],
  )

  const runExample = useCallback(
    (ex: Example) => {
      if (busyRef.current) return
      const bot = activeBotRef.current
      const s = { ...settingsRef.current[bot], ...(ex.patch || {}) }
      if (ex.patch) setSettings((prev) => ({ ...prev, [bot]: s }))
      const history = messagesRef.current
      pushMsg({ role: 'user', kind: 'text', text: ex.text })
      generate(bot, ex.text, { settingsOverride: s, history })
    },
    [pushMsg, generate],
  )

  const refine = useCallback(
    (m: Msg, r: Refine) => {
      if (busyRef.current) return
      const bot = activeBotRef.current
      const history = messagesRef.current
      pushMsg({ role: 'user', kind: 'text', text: r.label })
      generate(bot, m.sourceIdea || m.title || '', { modifier: r.mod, langOverride: r.lang, history })
    },
    [pushMsg, generate],
  )

  const settingsFor = useCallback((botId: BotId) => settingsRef.current[botId], [])

  const loadConversation = useCallback(async (id: string) => {
    try {
      const conv = await convApi.get(id)
      skipSave.current = true
      let max = 0
      conv.messages.forEach((m) => {
        if (m.id > max) max = m.id
      })
      uid.current = max + 1
      if (cfg[conv.botId]) setActiveBot(conv.botId)
      setConvId(conv.id)
      convIdRef.current = conv.id
      setMessages(conv.messages)
      setResetToken((t) => t + 1)
    } catch {
      /* ignore */
    }
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await convApi.remove(id)
      } catch {
        /* ignore */
      }
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (convIdRef.current === id) {
        setConvId(null)
        convIdRef.current = null
        setMessages([])
        setResetToken((t) => t + 1)
      }
    },
    [],
  )

  const store: ChatStore = {
    activeBot,
    settings,
    messages,
    convId,
    conversations,
    model,
    models,
    busy,
    resetToken,
    switchBot,
    setSetting,
    setModel,
    newChat,
    stop,
    send,
    runExample,
    refine,
    completeRaw,
    settingsFor,
    refreshConversations,
    loadConversation,
    deleteConversation,
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
