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
import { buildPrompt, parse, type MediaKind } from '../prompts'
import { claude, models as modelsApi, ApiError, type Message } from '../api'
import type { BotState, ImageData, ModelOption, Msg, Settings } from '../types'

type Example = { text: string; patch?: Record<string, string> }
type Refine = { label: string; mod: string; lang?: 'en' | 'fa' }

export type ChatStore = {
  activeBot: BotId
  bots: Record<BotId, BotState>
  model: string
  models: ModelOption[]
  busy: boolean
  resetToken: number
  switchBot: (id: BotId) => void
  setSetting: (key: string, value: string) => void
  setModel: (id: string) => void
  newChat: () => void
  send: (idea: string, image?: ImageData | null) => void
  runExample: (ex: Example) => void
  refine: (m: Msg, r: Refine) => void
  completeRaw: (messages: Message[]) => Promise<string>
  settingsFor: (botId: BotId) => Settings
}

const Ctx = createContext<ChatStore | null>(null)

export function useChat(): ChatStore {
  const c = useContext(Ctx)
  if (!c) throw new Error('useChat must be used within ChatProvider')
  return c
}

function initialBots(): Record<BotId, BotState> {
  const bots = {} as Record<BotId, BotState>
  ORDER.forEach((id) => {
    bots[id] = { messages: [], settings: { ...defaultSettings[id] } }
  })
  return bots
}

const STORAGE_KEY = 'mrc-gpts-v2'
const MODEL_KEY = 'mrc-model'

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeBot, setActiveBot] = useState<BotId>('prompt')
  const [bots, setBots] = useState<Record<BotId, BotState>>(initialBots)
  const [model, setModelState] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [busy, setBusy] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // Refs mirror latest state so async flows read fresh values (like a class instance).
  const uid = useRef(1)
  const botsRef = useRef(bots)
  const modelRef = useRef(model)
  const busyRef = useRef(busy)
  const activeBotRef = useRef(activeBot)
  botsRef.current = bots
  modelRef.current = model
  busyRef.current = busy
  activeBotRef.current = activeBot

  // ---- load persisted state ----
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved && saved.bots) {
        const next = {} as Record<BotId, BotState>
        ORDER.forEach((id) => {
          const s = saved.bots[id] || {}
          next[id] = {
            messages: Array.isArray(s.messages) ? s.messages : [],
            settings: Object.assign({}, defaultSettings[id], s.settings || {}),
          }
        })
        setBots(next)
        if (saved.activeBot && cfg[saved.activeBot as BotId]) setActiveBot(saved.activeBot)
        let max = 0
        ORDER.forEach((id) => next[id].messages.forEach((m) => { if (m.id > max) max = m.id }))
        uid.current = max + 1
      }
    } catch {
      /* ignore */
    }
    try {
      const savedModel = localStorage.getItem(MODEL_KEY)
      if (savedModel) setModelState(savedModel)
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  // ---- fetch model catalog; default the selection ----
  useEffect(() => {
    let alive = true
    modelsApi
      .list()
      .then((list) => {
        if (!alive) return
        setModels(list)
        setModelState((cur) => cur || (list[0] ? list[0].id : ''))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // ---- persist ----
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeBot, bots }))
    } catch {
      try {
        const lite = { activeBot, bots: {} as Record<string, unknown> }
        for (const id in bots) {
          const b = bots[id as BotId]
          lite.bots[id] = {
            settings: b.settings,
            messages: b.messages.map((m) => { const c = { ...m }; delete c.image; return c }),
          }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lite))
      } catch {
        /* ignore */
      }
    }
  }, [activeBot, bots, loaded])

  useEffect(() => {
    if (loaded && model) {
      try {
        localStorage.setItem(MODEL_KEY, model)
      } catch {
        /* ignore */
      }
    }
  }, [model, loaded])

  // ---- message helpers ----
  const pushMsg = useCallback((botId: BotId, m: Omit<Msg, 'id'>): number => {
    const id = uid.current++
    setBots((prev) => ({
      ...prev,
      [botId]: { ...prev[botId], messages: [...prev[botId].messages, { id, ...m }] },
    }))
    return id
  }, [])

  const replaceMsg = useCallback((botId: BotId, mid: number, patch: Omit<Msg, 'id'>) => {
    setBots((prev) => ({
      ...prev,
      [botId]: {
        ...prev[botId],
        messages: prev[botId].messages.map((m) => (m.id === mid ? ({ id: mid, ...patch } as Msg) : m)),
      },
    }))
  }, [])

  const completeRaw = useCallback((messages: Message[]) => {
    return claude.complete({ messages, model: modelRef.current || undefined })
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
      } = {},
    ) => {
      const settings: Settings = { ...(opts.settingsOverride || botsRef.current[botId].settings) }
      if (opts.langOverride) settings.lang = opts.langOverride
      const loadingId = pushMsg(botId, { role: 'assistant', kind: 'loading', loadingText: cfg[botId].loadingText })
      setBusy(true)
      try {
        const mediaKind: MediaKind = opts.image ? (opts.image.isVideo ? 'video' : 'image') : null
        const content = buildPrompt(botId, idea, settings, opts.modifier, mediaKind)
        let raw: string
        if (opts.image) {
          const blocks = [
            { type: 'image' as const, source: { type: 'base64' as const, media_type: opts.image.mediaType, data: opts.image.base64 } },
            { type: 'text' as const, text: content },
          ]
          raw = await claude.complete({ messages: [{ role: 'user', content: blocks }], model: modelRef.current || undefined })
        } else {
          raw = await claude.complete({ messages: [{ role: 'user', content }], model: modelRef.current || undefined })
        }
        const data = parse(raw)
        replaceMsg(botId, loadingId, {
          role: 'assistant',
          kind: 'prompt',
          title: data.title,
          prompt: data.prompt,
          tips: data.tips,
          copyLabel: cfg[botId].resultLabel,
          copyToast: cfg[botId].copyToast,
          promptLang: botId === 'prompt' ? ((settings.lang as 'fa' | 'en') || 'fa') : 'fa',
          sourceIdea: idea,
        })
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'server'
        let msg: string
        if (code === 'no-api')
          msg = 'برای پاسخِ زنده باید سرورِ مدل (نبوگیت) متصل باشد؛ این‌جا فعلاً فقط پیش‌نمایشِ ظاهر است.'
        else if (code === 'quota_exceeded')
          msg = (err as ApiError).message || 'سقفِ پیام‌های امروزت پر شده. برای ادامه اشتراک تهیه کن.'
        else if (code === 'unauthenticated') msg = 'نشستت منقضی شده؛ دوباره وارد شو.'
        else if (code === 'offline') msg = 'اتصال به سرور قطع شد. چند لحظه بعد دوباره امتحان کن.'
        else if (opts.image)
          msg = 'نتونستم این تصویر رو پردازش کنم. یه عکسِ واضح‌تر و بزرگ‌تر (JPG یا PNG) بفرست و دوباره امتحان کن.'
        else msg = 'یه مشکلی پیش اومد. چند لحظه صبر کن و دوباره بفرست.'
        replaceMsg(botId, loadingId, { role: 'assistant', kind: 'error', text: msg })
      } finally {
        setBusy(false)
      }
    },
    [pushMsg, replaceMsg],
  )

  // ---- public actions ----
  const switchBot = useCallback((id: BotId) => {
    setActiveBot((cur) => {
      if (id !== cur) setResetToken((t) => t + 1)
      return id
    })
  }, [])

  const setSetting = useCallback((key: string, value: string) => {
    const id = activeBotRef.current
    setBots((prev) => ({ ...prev, [id]: { ...prev[id], settings: { ...prev[id].settings, [key]: value } } }))
  }, [])

  const setModel = useCallback((id: string) => setModelState(id), [])

  const newChat = useCallback(() => {
    const id = activeBotRef.current
    setBots((prev) => ({ ...prev, [id]: { ...prev[id], messages: [] } }))
    setResetToken((t) => t + 1)
  }, [])

  const send = useCallback(
    (idea: string, image?: ImageData | null) => {
      const text = (idea || '').trim()
      if ((!text && !image) || busyRef.current) return
      const bot = activeBotRef.current
      pushMsg(bot, { role: 'user', kind: 'text', text, image: image ? image.dataURL : null })
      generate(bot, text, { image })
    },
    [pushMsg, generate],
  )

  const runExample = useCallback(
    (ex: Example) => {
      if (busyRef.current) return
      const bot = activeBotRef.current
      const settings = { ...botsRef.current[bot].settings, ...(ex.patch || {}) }
      if (ex.patch) setBots((prev) => ({ ...prev, [bot]: { ...prev[bot], settings } }))
      pushMsg(bot, { role: 'user', kind: 'text', text: ex.text })
      generate(bot, ex.text, { settingsOverride: settings })
    },
    [pushMsg, generate],
  )

  const refine = useCallback(
    (m: Msg, r: Refine) => {
      if (busyRef.current) return
      const bot = activeBotRef.current
      pushMsg(bot, { role: 'user', kind: 'text', text: r.label })
      generate(bot, m.sourceIdea || m.title || '', { modifier: r.mod, langOverride: r.lang })
    },
    [pushMsg, generate],
  )

  const settingsFor = useCallback((botId: BotId) => botsRef.current[botId].settings, [])

  const store: ChatStore = {
    activeBot,
    bots,
    model,
    models,
    busy,
    resetToken,
    switchBot,
    setSetting,
    setModel,
    newChat,
    send,
    runExample,
    refine,
    completeRaw,
    settingsFor,
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
