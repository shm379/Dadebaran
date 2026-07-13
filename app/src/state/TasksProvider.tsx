import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildPrompt, parse } from '../prompts'
import { useChat } from './ChatProvider'
import { useToast } from './ToastProvider'
import type { Repeat, Task, TaskDraft } from '../types'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const STORAGE_KEY = 'mrc-tasks'

export type TasksStore = {
  tasks: Task[]
  draft: TaskDraft
  setDraft: (key: keyof TaskDraft, value: string) => void
  addTask: () => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  runTask: (id: string) => void
  faDigits: (s: string | number) => string
  formatNext: (ts: number | null) => string
}

const Ctx = createContext<TasksStore | null>(null)

export function useTasks(): TasksStore {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTasks must be used within TasksProvider')
  return c
}

function faDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[+d])
}

function computeNextRun(repeat: Repeat, time: string): number {
  if (repeat === 'hourly') return Date.now() + 3600 * 1000
  const parts = (time || '09:00').split(':')
  const hh = parseInt(parts[0], 10) || 0
  const mm = parseInt(parts[1], 10) || 0
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  if (repeat === 'once') return d.getTime() <= Date.now() ? Date.now() + 60000 : d.getTime()
  if (repeat === 'daily') {
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  if (repeat === 'weekly') {
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7)
    return d.getTime()
  }
  return d.getTime()
}

function formatNext(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const hm = faDigits(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2))
  const tm = new Date(now)
  tm.setDate(now.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return 'امروز ' + hm
  if (d.toDateString() === tm.toDateString()) return 'فردا ' + hm
  return faDigits(('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2)) + ' ' + hm
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { completeRaw, settingsFor } = useChat()
  const { showToast } = useToast()

  const [tasks, setTasks] = useState<Task[]>([])
  const [draft, setDraftState] = useState<TaskDraft>({ botId: 'prompt', input: '', repeat: 'daily', time: '09:00' })
  const [loaded, setLoaded] = useState(false)
  const tasksRef = useRef(tasks)
  const draftRef = useRef(draft)
  tasksRef.current = tasks
  draftRef.current = draft

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (Array.isArray(t)) setTasks(t)
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      /* ignore */
    }
  }, [tasks, loaded])

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const runTask = useCallback(
    async (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id)
      if (!task || task.status === 'running') return
      updateTask(id, { status: 'running' })
      try {
        const settings = settingsFor(task.botId)
        const content = buildPrompt(task.botId, task.input, settings, undefined, null)
        const raw = await completeRaw([{ role: 'user', content }])
        const data = parse(raw)
        const next = task.repeat === 'once' ? task.nextRun : computeNextRun(task.repeat, task.time)
        updateTask(id, {
          status: 'done',
          lastRun: Date.now(),
          lastResult: { title: data.title, prompt: data.prompt },
          nextRun: next,
          enabled: task.repeat === 'once' ? false : task.enabled,
        })
        showToast('یک کارِ زمان‌بندی‌شده اجرا شد ✓')
      } catch {
        updateTask(id, { status: 'error' })
        showToast('اجرای کار ناموفق بود')
      }
    },
    [completeRaw, settingsFor, showToast, updateTask],
  )

  // scheduler
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      tasksRef.current.forEach((t) => {
        if (t.enabled && t.status !== 'running' && t.nextRun && t.nextRun <= now) runTask(t.id)
      })
    }
    const iv = setInterval(check, 30000)
    const kick = setTimeout(check, 1500)
    return () => {
      clearInterval(iv)
      clearTimeout(kick)
    }
  }, [runTask])

  const setDraft = useCallback((key: keyof TaskDraft, value: string) => {
    setDraftState((d) => ({ ...d, [key]: value }))
  }, [])

  const addTask = useCallback(() => {
    // Side effects live outside the state updater so React StrictMode's
    // double-invocation can't add the task (or toast) twice.
    const d = draftRef.current
    const input = (d.input || '').trim()
    if (!input) {
      showToast('متنِ کار را بنویس')
      return
    }
    const task: Task = {
      id: 'tk' + Date.now(),
      botId: d.botId,
      input,
      repeat: d.repeat,
      time: d.time,
      enabled: true,
      lastRun: null,
      lastResult: null,
      status: 'idle',
      nextRun: computeNextRun(d.repeat, d.time),
    }
    setTasks((prev) => [task, ...prev])
    setDraftState((prev) => ({ ...prev, input: '' }))
    showToast('کار زمان‌بندی شد ✓')
  }, [showToast])

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, enabled: !t.enabled, nextRun: !t.enabled ? computeNextRun(t.repeat, t.time) : t.nextRun }
          : t,
      ),
    )
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const store: TasksStore = {
    tasks,
    draft,
    setDraft,
    addTask,
    toggleTask,
    deleteTask,
    runTask,
    faDigits,
    formatNext,
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
