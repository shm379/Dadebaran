import { Component, type ReactNode } from 'react'
import { css } from './css'
import { HoverButton } from './Hover'
import { claude } from './api'
import { buildPrompt, parse, type MediaKind, type Settings } from './prompts'
import { cfg, GROUPS, ORDER, defaultSettings, type BotId } from './config'
import type { AppState, ImageData, Msg, Repeat, Task } from './types'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function initialBots(): AppState['bots'] {
  const bots = {} as AppState['bots']
  ORDER.forEach((id) => {
    bots[id] = { messages: [], settings: { ...defaultSettings[id] } }
  })
  return bots
}

export default class App extends Component<Record<string, never>, AppState> {
  uid = 1
  recog: SpeechRecognitionLike | null = null
  vrecog: SpeechRecognitionLike | null = null
  bars: HTMLDivElement[] = []
  vizEl: HTMLDivElement | null = null
  scrollEl: HTMLDivElement | null = null
  fileEl: HTMLInputElement | null = null
  videoEl: HTMLInputElement | null = null
  audioCtx: AudioContext | null = null
  analyser: AnalyserNode | null = null
  micStream: MediaStream | null = null
  vizData: Uint8Array<ArrayBuffer> | null = null
  vizRAF: number | null = null
  _ta: HTMLTextAreaElement | null = null
  _dictBase = ''
  _taskTimer: ReturnType<typeof setInterval> | null = null
  _tt: ReturnType<typeof setTimeout> | null = null

  state: AppState = {
    activeBot: 'prompt',
    bots: initialBots(),
    input: '',
    pendingImage: null,
    listening: false,
    voiceMode: false,
    voiceState: 'idle',
    voiceTranscript: '',
    voiceReply: '',
    speakReplies: true,
    tasksOpen: false,
    tasks: [],
    taskDraft: { botId: 'prompt', input: '', repeat: 'daily', time: '09:00' },
    busy: false,
    showSidebar: true,
    toast: '',
  }

  componentDidMount() {
    const patch: Partial<AppState> = {}
    try {
      const saved = JSON.parse(localStorage.getItem('mrc-gpts-v2') || 'null')
      if (saved && saved.bots) {
        const bots = {} as AppState['bots']
        ORDER.forEach((id) => {
          const base = this.state.bots[id]
          const s = saved.bots[id] || {}
          bots[id] = {
            messages: Array.isArray(s.messages) ? s.messages : [],
            settings: Object.assign({}, base.settings, s.settings || {}),
          }
        })
        patch.bots = bots
        if (saved.activeBot && cfg[saved.activeBot as BotId]) patch.activeBot = saved.activeBot
        let max = 0
        ORDER.forEach((id) =>
          (bots[id].messages || []).forEach((m) => {
            if (m.id > max) max = m.id
          }),
        )
        this.uid = max + 1
      }
    } catch {
      /* ignore */
    }
    try {
      const t = JSON.parse(localStorage.getItem('mrc-tasks') || 'null')
      if (Array.isArray(t)) patch.tasks = t
    } catch {
      /* ignore */
    }
    if (Object.keys(patch).length) this.setState(patch as AppState)
    this._taskTimer = setInterval(() => this.checkDueTasks(), 30000)
    setTimeout(() => this.checkDueTasks(), 1500)
  }

  componentDidUpdate() {
    const bot = this.state.bots[this.state.activeBot]
    if (this.scrollEl && bot && bot.messages.length) this.scrollEl.scrollTop = this.scrollEl.scrollHeight
  }

  componentWillUnmount() {
    this.stopAllVoice()
    if (this.recog) {
      try {
        this.recog.stop()
      } catch {
        /* ignore */
      }
    }
    if (this._taskTimer) clearInterval(this._taskTimer)
  }

  save() {
    try {
      localStorage.setItem(
        'mrc-gpts-v2',
        JSON.stringify({ activeBot: this.state.activeBot, bots: this.state.bots }),
      )
    } catch {
      try {
        const lite: { activeBot: BotId; bots: Record<string, unknown> } = {
          activeBot: this.state.activeBot,
          bots: {},
        }
        for (const id in this.state.bots) {
          const b = this.state.bots[id as BotId]
          lite.bots[id] = {
            settings: b.settings,
            messages: b.messages.map((m) => {
              const c = Object.assign({}, m)
              delete c.image
              return c
            }),
          }
        }
        localStorage.setItem('mrc-gpts-v2', JSON.stringify(lite))
      } catch {
        /* ignore */
      }
    }
  }

  // ---- Image / video attachment ----
  openFilePicker() {
    if (this.fileEl) this.fileEl.click()
  }
  clearImage() {
    this.setState({ pendingImage: null })
  }
  resizeImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const max = 1024
          let w = img.width,
            h = img.height
          if (w > max || h > max) {
            const r = Math.min(max / w, max / h)
            w = Math.round(w * r)
            h = Math.round(h * r)
          }
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          c.getContext('2d')!.drawImage(img, 0, 0, w, h)
          const dataURL = c.toDataURL('image/jpeg', 0.85)
          resolve({ dataURL, mediaType: 'image/jpeg', base64: dataURL.split(',')[1] })
        }
        img.onerror = reject
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  async onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file || !/^image\//.test(file.type)) return
    try {
      const img = await this.resizeImage(file)
      this.setState({ pendingImage: img })
    } catch {
      this.showToast('بارگذاریِ تصویر ناموفق بود')
    }
  }

  openVideoPicker() {
    if (this.videoEl) this.videoEl.click()
  }
  async onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file || !/^video\//.test(file.type)) return
    this.showToast('در حال آماده‌سازیِ ویدیو…')
    try {
      const frame = await this.extractVideoFrame(file)
      this.setState({ pendingImage: Object.assign({}, frame, { isVideo: true }) })
    } catch {
      this.showToast('نتونستم از ویدیو فریم بگیرم')
    }
  }
  extractVideoFrame(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.preload = 'metadata'
      v.src = url
      const done = () => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          /* ignore */
        }
      }
      const fail = (e?: unknown) => {
        done()
        reject(e || new Error('video'))
      }
      v.onloadeddata = () => {
        try {
          v.currentTime = Math.min(1, (v.duration || 2) / 2)
        } catch (e) {
          fail(e)
        }
      }
      v.onseeked = () => {
        try {
          const max = 1024
          let w = v.videoWidth || 640,
            h = v.videoHeight || 360
          if (w > max || h > max) {
            const r = Math.min(max / w, max / h)
            w = Math.round(w * r)
            h = Math.round(h * r)
          }
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          c.getContext('2d')!.drawImage(v, 0, 0, w, h)
          const dataURL = c.toDataURL('image/jpeg', 0.85)
          done()
          resolve({ dataURL, mediaType: 'image/jpeg', base64: dataURL.split(',')[1] })
        } catch (e) {
          fail(e)
        }
      }
      v.onerror = () => fail(new Error('video'))
      setTimeout(() => fail(new Error('timeout')), 9000)
    })
  }

  // ---- Speech recognition (dictation) ----
  getSR(): SpeechRecognitionLike | null {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    return SR ? new SR() : null
  }
  toggleDictation() {
    if (this.state.listening) {
      if (this.recog) {
        try {
          this.recog.stop()
        } catch {
          /* ignore */
        }
      }
      return
    }
    const r = this.getSR()
    if (!r) {
      this.showToast('مرورگرت از تبدیلِ گفتار به متن پشتیبانی نمی‌کنه')
      return
    }
    r.lang = 'fa-IR'
    r.interimResults = true
    r.continuous = false
    this._dictBase = this.state.input ? this.state.input + ' ' : ''
    r.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      this.setState({ input: this._dictBase + t })
    }
    r.onerror = () => {
      this.setState({ listening: false })
    }
    r.onend = () => {
      this.setState({ listening: false })
      this.recog = null
    }
    this.recog = r
    this.setState({ listening: true })
    try {
      r.start()
    } catch {
      this.setState({ listening: false })
    }
  }

  // ---- Voice conversation mode ----
  openVoiceMode() {
    this.setState({ voiceMode: true, voiceState: 'idle', voiceTranscript: '', voiceReply: '' })
  }
  closeVoiceMode() {
    this.stopAllVoice()
    this.setState({ voiceMode: false, voiceState: 'idle' })
  }
  stopAllVoice() {
    if (this.vrecog) {
      try {
        this.vrecog.stop()
      } catch {
        /* ignore */
      }
      this.vrecog = null
    }
    this.stopViz()
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }
  voiceTurn() {
    const s = this.state.voiceState
    if (s === 'listening') {
      if (this.vrecog) {
        try {
          this.vrecog.stop()
        } catch {
          /* ignore */
        }
      }
      return
    }
    if (s === 'speaking') {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
      this.setState({ voiceState: 'idle' })
      return
    }
    if (s === 'thinking') return
    this.startVoiceTurn()
  }
  startVoiceTurn() {
    const r = this.getSR()
    if (!r) {
      this.showToast('مرورگرت از گفت‌وگوی صوتی پشتیبانی نمی‌کنه')
      return
    }
    r.lang = 'fa-IR'
    r.interimResults = true
    r.continuous = false
    let finalT = ''
    r.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      finalT = t
      this.setState({ voiceTranscript: t })
    }
    r.onerror = () => {
      this.stopViz()
      this.setState({ voiceState: 'idle' })
    }
    r.onend = () => {
      this.vrecog = null
      this.stopViz()
      const txt = (finalT || '').trim()
      if (txt) this.handleVoiceQuery(txt)
      else this.setState({ voiceState: 'idle' })
    }
    this.vrecog = r
    this.setState({ voiceState: 'listening', voiceReply: '', voiceTranscript: '' })
    this.startViz()
    try {
      r.start()
    } catch {
      this.stopViz()
      this.setState({ voiceState: 'idle' })
    }
  }
  async handleVoiceQuery(text: string) {
    this.setState({ voiceState: 'thinking' })
    try {
      const sys =
        'تو یک دستیارِ صوتیِ فارسی‌زبانِ گرم و خودمونی هستی. کوتاه و محاوره‌ای جواب بده (حداکثر چند جمله)، طوری که وقتی بلند خونده بشه طبیعی باشه. بدونِ مارک‌داون و بدونِ ایموجی.'
      const reply = await claude.complete({
        messages: [{ role: 'user', content: sys + '\n\nکاربر گفت: «' + text + '»\n\nپاسخِ کوتاهِ صوتی:' }],
      })
      const clean = (reply || '').trim()
      this.setState({ voiceReply: clean, voiceState: this.state.speakReplies ? 'speaking' : 'idle' })
      if (this.state.speakReplies) this.speak(clean)
    } catch {
      this.setState({ voiceReply: 'نشد جواب بدم؛ دوباره امتحان کن.', voiceState: 'idle' })
    }
  }
  speak(text: string) {
    try {
      const synth = window.speechSynthesis
      if (!synth) {
        this.setState({ voiceState: 'idle' })
        return
      }
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'fa-IR'
      u.rate = 1
      u.pitch = 1
      const voices = synth.getVoices() || []
      const fa = voices.find((v) => /fa|persian|فارس/i.test((v.lang || '') + (v.name || '')))
      if (fa) u.voice = fa
      u.onend = () => {
        this.setState((s) => (s.voiceState === 'speaking' ? { voiceState: 'idle' } : null))
      }
      u.onerror = () => {
        this.setState((s) => (s.voiceState === 'speaking' ? { voiceState: 'idle' } : null))
      }
      synth.speak(u)
    } catch {
      this.setState({ voiceState: 'idle' })
    }
  }
  toggleSpeakReplies() {
    this.setState((s) => ({ speakReplies: !s.speakReplies }))
  }

  // ---- Frequency visualizer ----
  setVizRef(el: HTMLDivElement | null) {
    this.vizEl = el
    if (el && !el.childElementCount) this.buildBars(el)
  }
  buildBars(el: HTMLDivElement) {
    el.innerHTML = ''
    this.bars = []
    for (let i = 0; i < 32; i++) {
      const b = document.createElement('div')
      b.style.cssText =
        'width:5px;height:8px;border-radius:99px;background:linear-gradient(180deg,#7cc0ff,#167afe);transition:height .07s linear;'
      el.appendChild(b)
      this.bars.push(b)
    }
  }
  async startViz() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.idleViz()
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.micStream = stream
      const Ctx = window.AudioContext || window.webkitAudioContext!
      this.audioCtx = new Ctx()
      const src = this.audioCtx.createMediaStreamSource(stream)
      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 64
      src.connect(this.analyser)
      this.vizData = new Uint8Array(this.analyser.frequencyBinCount)
      const loop = () => {
        if (!this.analyser) return
        this.analyser.getByteFrequencyData(this.vizData!)
        const bars = this.bars || []
        for (let i = 0; i < bars.length; i++) {
          const v = this.vizData![i % this.vizData!.length] / 255
          bars[i].style.height = 8 + Math.round(v * 74) + 'px'
        }
        this.vizRAF = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      this.idleViz()
    }
  }
  idleViz() {
    const bars = this.bars || []
    let t = 0
    const loop = () => {
      if (this.state.voiceState !== 'listening') return
      t += 0.16
      for (let i = 0; i < bars.length; i++)
        bars[i].style.height = 8 + Math.abs(Math.sin(t + i * 0.4)) * 42 + 'px'
      this.vizRAF = requestAnimationFrame(loop)
    }
    loop()
  }
  stopViz() {
    if (this.vizRAF) cancelAnimationFrame(this.vizRAF)
    this.vizRAF = null
    this.analyser = null
    if (this.audioCtx) {
      try {
        this.audioCtx.close()
      } catch {
        /* ignore */
      }
      this.audioCtx = null
    }
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((t) => t.stop())
      } catch {
        /* ignore */
      }
      this.micStream = null
    }
    ;(this.bars || []).forEach((b) => {
      b.style.height = '8px'
    })
  }

  // ---- Scheduled tasks ----
  saveTasks(list?: Task[]) {
    try {
      localStorage.setItem('mrc-tasks', JSON.stringify(list || this.state.tasks))
    } catch {
      /* ignore */
    }
  }
  openTasks() {
    this.setState({ tasksOpen: true })
  }
  closeTasks() {
    this.setState({ tasksOpen: false })
  }
  setDraft(key: keyof AppState['taskDraft'], val: string) {
    this.setState((s) => ({ taskDraft: Object.assign({}, s.taskDraft, { [key]: val }) }))
  }
  faDigits(s: string | number) {
    return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[+d])
  }
  computeNextRun(repeat: Repeat, time: string): number {
    if (repeat === 'hourly') return Date.now() + 3600 * 1000
    const parts = (time || '09:00').split(':')
    const hh = parseInt(parts[0], 10) || 0,
      mm = parseInt(parts[1], 10) || 0
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
  formatNext(ts: number | null) {
    if (!ts) return '—'
    const d = new Date(ts),
      now = new Date()
    const hm = this.faDigits(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2))
    const tm = new Date(now)
    tm.setDate(now.getDate() + 1)
    if (d.toDateString() === now.toDateString()) return 'امروز ' + hm
    if (d.toDateString() === tm.toDateString()) return 'فردا ' + hm
    return this.faDigits(('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2)) + ' ' + hm
  }
  addTask() {
    const d = this.state.taskDraft
    const input = (d.input || '').trim()
    if (!input) {
      this.showToast('متنِ کار را بنویس')
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
      nextRun: this.computeNextRun(d.repeat, d.time),
    }
    const list = [task].concat(this.state.tasks)
    this.setState({ tasks: list, taskDraft: Object.assign({}, d, { input: '' }) }, () => this.saveTasks())
    this.showToast('کار زمان‌بندی شد ✓')
  }
  updateTask(id: string, patch: Partial<Task>) {
    const list = this.state.tasks.map((t) => (t.id === id ? Object.assign({}, t, patch) : t))
    this.setState({ tasks: list }, () => this.saveTasks())
    return list
  }
  toggleTask(id: string) {
    const t = this.state.tasks.find((x) => x.id === id)
    if (t)
      this.updateTask(id, {
        enabled: !t.enabled,
        nextRun: !t.enabled ? this.computeNextRun(t.repeat, t.time) : t.nextRun,
      })
  }
  deleteTask(id: string) {
    const list = this.state.tasks.filter((t) => t.id !== id)
    this.setState({ tasks: list }, () => this.saveTasks())
  }
  checkDueTasks() {
    const now = Date.now()
    ;(this.state.tasks || []).forEach((t) => {
      if (t.enabled && t.status !== 'running' && t.nextRun && t.nextRun <= now) this.runTask(t.id)
    })
  }
  async runTask(id: string) {
    const task = this.state.tasks.find((t) => t.id === id)
    if (!task || task.status === 'running') return
    this.updateTask(id, { status: 'running' })
    try {
      const settings = this.state.bots[task.botId].settings
      const content = buildPrompt(task.botId, task.input, settings, undefined, null)
      const raw = await claude.complete({ messages: [{ role: 'user', content }] })
      const data = parse(raw)
      const next = task.repeat === 'once' ? task.nextRun : this.computeNextRun(task.repeat, task.time)
      this.updateTask(id, {
        status: 'done',
        lastRun: Date.now(),
        lastResult: { title: data.title, prompt: data.prompt },
        nextRun: next,
        enabled: task.repeat === 'once' ? false : task.enabled,
      })
      this.showToast('یک کارِ زمان‌بندی‌شده اجرا شد ✓')
    } catch {
      this.updateTask(id, { status: 'error' })
      this.showToast('اجرای کار ناموفق بود')
    }
  }
  taskRepeatStyle(active: boolean) {
    return (
      'flex:1;padding:.42rem .2rem;border-radius:9px;font-size:.76rem;font-weight:600;cursor:pointer;border:1px solid ' +
      (active ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.12)') +
      ';background:' +
      (active ? 'rgba(22,122,254,.22)' : 'transparent') +
      ';color:' +
      (active ? '#fff' : 'rgba(245,250,255,.66)') +
      ';'
    )
  }

  // ---- Dynamic style helpers ----
  micBtnStyle(active: boolean) {
    return (
      'position:relative;flex:none;width:42px;height:42px;display:grid;place-items:center;border-radius:13px;cursor:pointer;transition:all .18s ease;border:1px solid ' +
      (active ? 'rgba(255,80,80,.7)' : 'rgba(255,255,255,.18)') +
      ';background:' +
      (active ? 'rgba(255,80,80,.18)' : 'rgba(255,255,255,.05)') +
      ';color:' +
      (active ? '#ffd0d0' : '#cfe1ff') +
      ';'
    )
  }
  voiceBtnStyle(s: string) {
    const c = s === 'listening' ? 'rgba(255,80,80,1)' : s === 'thinking' ? 'rgba(124,192,255,1)' : '#167afe'
    const bg =
      s === 'listening' ? 'linear-gradient(180deg,#ff6b6b,#d63a3a)' : 'linear-gradient(180deg,#2488ff,#1460ca)'
    const anim = s === 'listening' || s === 'speaking' ? 'animation:mrcPulse 1.4s ease-in-out infinite;' : ''
    return (
      'position:relative;width:108px;height:108px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#fff;border:1px solid ' +
      c +
      ';background:' +
      bg +
      ';box-shadow:0 14px 40px rgba(7,17,47,.5),inset 0 0 50px rgba(255,255,255,.12);' +
      anim
    )
  }
  speakChipStyle(active: boolean) {
    return (
      'display:inline-flex;align-items:center;gap:6px;padding:.42rem .8rem;border-radius:99px;font-size:.78rem;font-weight:600;cursor:pointer;border:1px solid ' +
      (active ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.16)') +
      ';background:' +
      (active ? 'rgba(22,122,254,.22)' : 'rgba(255,255,255,.05)') +
      ';color:' +
      (active ? '#fff' : 'rgba(245,250,255,.6)') +
      ';'
    )
  }

  // ---- Conversation state ----
  updateBot(id: BotId, fn: (b: AppState['bots'][BotId]) => Partial<AppState['bots'][BotId]>) {
    this.setState(
      (s) => ({ bots: Object.assign({}, s.bots, { [id]: Object.assign({}, s.bots[id], fn(s.bots[id])) }) }),
      () => this.save(),
    )
  }
  pushMsg(id: BotId, m: Omit<Msg, 'id'>) {
    const msg: Msg = Object.assign({ id: this.uid++ }, m)
    this.updateBot(id, (b) => ({ messages: [...b.messages, msg] }))
    return msg.id
  }
  replaceMsg(id: BotId, mid: number, patch: Omit<Msg, 'id'>) {
    this.updateBot(id, (b) => ({
      messages: b.messages.map((m) => (m.id === mid ? (Object.assign({ id: mid }, patch) as Msg) : m)),
    }))
  }

  switchBot(id: BotId) {
    if (id !== this.state.activeBot) this.setState({ activeBot: id, input: '' }, () => this.save())
  }
  setSetting(key: string, value: string) {
    this.updateBot(this.state.activeBot, (b) => ({ settings: Object.assign({}, b.settings, { [key]: value }) }))
  }
  toggleSidebar() {
    this.setState((s) => ({ showSidebar: !s.showSidebar }))
  }
  newChat() {
    this.updateBot(this.state.activeBot, () => ({ messages: [] }))
    this.setState({ input: '' })
  }

  onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    this._ta = el
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    this.setState({ input: el.value })
  }
  onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.send()
    }
  }

  send() {
    const idea = (this.state.input || '').trim()
    const image = this.state.pendingImage
    if ((!idea && !image) || this.state.busy) return
    const bot = this.state.activeBot
    this.pushMsg(bot, { role: 'user', kind: 'text', text: idea, image: image ? image.dataURL : null })
    this.setState({ input: '', pendingImage: null })
    if (this._ta) this._ta.style.height = 'auto'
    this.generate(bot, idea, { image })
  }

  example(ex: { text: string; patch?: Record<string, string> }) {
    if (this.state.busy) return
    const bot = this.state.activeBot
    const settings = Object.assign({}, this.state.bots[bot].settings, ex.patch || {})
    if (ex.patch) this.updateBot(bot, (b) => ({ settings: Object.assign({}, b.settings, ex.patch) }))
    this.pushMsg(bot, { role: 'user', kind: 'text', text: ex.text })
    this.generate(bot, ex.text, { settingsOverride: settings })
  }

  refine(m: Msg, r: { mod: string; lang?: 'en' | 'fa'; label: string }) {
    if (this.state.busy) return
    const bot = this.state.activeBot
    this.pushMsg(bot, { role: 'user', kind: 'text', text: r.label })
    this.generate(bot, m.sourceIdea || m.title || '', { modifier: r.mod, langOverride: r.lang })
  }

  async generate(
    bot: BotId,
    idea: string,
    opts: {
      image?: ImageData | null
      settingsOverride?: Settings
      modifier?: string
      langOverride?: 'en' | 'fa'
    } = {},
  ) {
    const settings: Settings = Object.assign({}, opts.settingsOverride || this.state.bots[bot].settings)
    if (opts.langOverride) settings.lang = opts.langOverride
    const loadingId = this.pushMsg(bot, { role: 'assistant', kind: 'loading', loadingText: cfg[bot].loadingText })
    this.setState({ busy: true })
    try {
      const mediaKind: MediaKind = opts.image ? (opts.image.isVideo ? 'video' : 'image') : null
      const content = buildPrompt(bot, idea, settings, opts.modifier, mediaKind)
      let raw: string
      if (opts.image) {
        const blocks = [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: opts.image.mediaType, data: opts.image.base64 } },
          { type: 'text' as const, text: content },
        ]
        raw = await claude.complete({ messages: [{ role: 'user', content: blocks }] })
      } else {
        raw = await claude.complete({ messages: [{ role: 'user', content }] })
      }
      const data = parse(raw)
      this.replaceMsg(bot, loadingId, {
        role: 'assistant',
        kind: 'prompt',
        title: data.title,
        prompt: data.prompt,
        tips: data.tips,
        copyLabel: cfg[bot].resultLabel,
        copyToast: cfg[bot].copyToast,
        promptLang: bot === 'prompt' ? ((settings.lang as 'fa' | 'en') || 'fa') : 'fa',
        sourceIdea: idea,
      })
    } catch (err) {
      let msg: string
      if (err && (err as Error).message === 'no-api')
        msg = 'برای پاسخِ زنده، این نمونه باید در محیطِ اجرای واقعی باز شود؛ این‌جا فقط پیش‌نمایشِ ظاهر است.'
      else if (opts.image)
        msg = 'نتونستم این تصویر رو پردازش کنم. یه عکسِ واضح‌تر و بزرگ‌تر (JPG یا PNG) بفرست و دوباره امتحان کن.'
      else msg = 'یه مشکلی پیش اومد. چند لحظه صبر کن و دوباره بفرست.'
      this.replaceMsg(bot, loadingId, { role: 'assistant', kind: 'error', text: msg })
    } finally {
      this.setState({ busy: false }, () => this.save())
    }
  }

  copy(text: string, toast?: string) {
    try {
      navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
    this.showToast(toast || 'کپی شد ✓')
  }
  showToast(t: string) {
    this.setState({ toast: t })
    if (this._tt) clearTimeout(this._tt)
    this._tt = setTimeout(() => this.setState({ toast: '' }), 1800)
  }

  render() {
    return this.renderView()
  }

  renderView() {
    const botId = this.state.activeBot
    const c = cfg[botId]
    const bd = this.state.bots[botId]
    const isEmpty = bd.messages.length === 0

    const settingsSummary = c.fields
      .map((f) => {
        const opt = f.options.find((o) => o.v === bd.settings[f.key])
        return opt ? opt.l || opt.v : ''
      })
      .filter(Boolean)
      .join(' · ')

    const bodyGridStyle =
      'flex:1;min-height:0;display:grid;grid-template-columns:' +
      (this.state.showSidebar ? '300px minmax(0,1fr)' : 'minmax(0,1fr)') +
      ';'

    return (
      <div
        dir="rtl"
        style={css(
          "height:100vh;display:flex;flex-direction:column;overflow:hidden;font-family:'Vazirmatn',Tahoma,sans-serif;color:#f7fbff;background:radial-gradient(circle at 18% -10%,rgba(22,122,254,.34),transparent 46%),radial-gradient(circle at 84% 116%,rgba(22,122,254,.2),transparent 56%),#101424;",
        )}
      >
        {this.renderHeader(c.name)}

        <div style={css(bodyGridStyle)}>
          <main style={css('min-height:0;min-width:0;display:flex;flex-direction:column;')}>
            <div
              ref={(el) => {
                this.scrollEl = el
              }}
              style={css('flex:1;min-height:0;overflow-y:auto;padding:26px 22px 8px;')}
            >
              {isEmpty ? this.renderHero(c) : this.renderMessages(bd.messages)}
            </div>
            {this.renderComposer(c, settingsSummary)}
          </main>
          {this.state.showSidebar && this.renderSidebar(botId, c)}
        </div>

        {this.state.tasksOpen && this.renderTasks()}
        {this.state.voiceMode && this.renderVoice(c.name)}
        {this.state.toast && (
          <div
            style={css(
              'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:50;padding:.7rem 1.2rem;border-radius:13px;font-size:.88rem;font-weight:600;color:#eaffef;background:rgba(16,40,30,.92);border:1px solid rgba(16,185,129,.5);box-shadow:0 12px 28px rgba(6,24,66,.45);backdrop-filter:blur(10px);animation:mrcToast .25s ease both;',
            )}
          >
            {this.state.toast}
          </div>
        )}
      </div>
    )
  }

  renderHeader(botName: string): ReactNode {
    const taskCount = this.state.tasks.length
    return (
      <header
        style={css(
          'flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 22px;backdrop-filter:blur(14px) saturate(180%);background:linear-gradient(180deg,rgba(10,13,24,.96),rgba(10,13,24,.8));border-bottom:1px solid rgba(255,255,255,.07);position:relative;z-index:20;',
        )}
      >
        <div style={css('display:flex;align-items:center;gap:12px;')}>
          <div
            style={css(
              'width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 40px rgba(22,122,254,.4);',
            )}
          >
            <img src="/assets/logo-mark-dark.svg" alt="MR.CHATGPT" style={css('width:24px;height:24px;')} />
          </div>
          <div style={css('display:flex;flex-direction:column;line-height:1.25;')}>
            <strong style={css('font-size:1.05rem;font-weight:700;')}>{botName}</strong>
            <span
              style={css(
                'font-size:.6rem;letter-spacing:.16em;color:rgba(245,250,255,.5);direction:ltr;text-align:right;',
              )}
            >
              MR.CHATGPT &middot; GPT
            </span>
          </div>
        </div>
        <div style={css('display:flex;align-items:center;gap:10px;')}>
          <HoverButton
            onClick={() => this.openTasks()}
            title="کارهای زمان‌بندی‌شده"
            aria-label="کارهای زمان‌بندی‌شده"
            styleStr="position:relative;width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.04);color:#dce8ff;cursor:pointer;"
            hoverStr="border-color:rgba(255,255,255,.45);"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeWidth="1.9" />
              <path
                d="M12 8.5v4.2l2.6 1.6M9 3.2l-2.4 1.6M15 3.2l2.4 1.6"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
            {taskCount > 0 && (
              <span
                style={css(
                  'position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:99px;background:#167afe;color:#fff;font-size:.62rem;font-weight:700;border:1.5px solid #101424;',
                )}
              >
                {this.faDigits(taskCount)}
              </span>
            )}
          </HoverButton>
          <HoverButton
            onClick={() => this.openVoiceMode()}
            title="گفت‌وگوی صوتی"
            aria-label="گفت‌وگوی صوتی"
            styleStr="width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(22,122,254,.55);background:rgba(22,122,254,.16);color:#bcd9ff;cursor:pointer;"
            hoverStr="border-color:rgba(22,122,254,.9);background:rgba(22,122,254,.28);color:#fff;"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 11v2M8 7.5v9M12 4.5v15M16 7.5v9M20 11v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </HoverButton>
          <HoverButton
            onClick={() => this.toggleSidebar()}
            title="پنل کناری"
            styleStr="width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.04);color:#dce8ff;cursor:pointer;"
            hoverStr="border-color:rgba(255,255,255,.45);"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </HoverButton>
          <HoverButton
            onClick={() => this.newChat()}
            styleStr="display:inline-flex;align-items:center;gap:7px;padding:.62rem 1.05rem;border-radius:12px;font-weight:600;font-size:.88rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);"
            hoverStr="filter:brightness(1.06);transform:translateY(-1px);"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            گفت‌وگوی جدید
          </HoverButton>
        </div>
      </header>
    )
  }

  renderHero(c: (typeof cfg)[BotId]): ReactNode {
    return (
      <div
        style={css(
          'max-width:760px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 0 18px;',
        )}
      >
        <div
          style={css(
            'width:84px;height:84px;display:grid;place-items:center;border-radius:24px;background:rgba(22,122,254,.16);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 0 88px rgba(22,122,254,.3),0 24px 80px rgba(7,17,47,.35);',
          )}
        >
          <img src="/assets/logo-mark-dark.svg" alt="" style={css('width:42px;height:42px;')} />
        </div>
        <h1 style={css('margin:22px 0 0;font-size:2.1rem;font-weight:800;line-height:1.28;color:#f3f8ff;')}>
          {c.heroPre}
          <span style={css('color:#60b0ff;')}>{c.heroAccent}</span>
          {c.heroPost}
        </h1>
        <p
          style={css(
            'margin:14px 0 0;max-width:31rem;color:rgba(245,250,255,.78);font-size:1.02rem;line-height:1.75;',
          )}
        >
          {c.heroSub}
        </p>
        <div
          style={css(
            'margin-top:30px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:right;',
          )}
        >
          {c.examples.map((ex, i) => (
            <HoverButton
              key={i}
              onClick={() => this.example(ex)}
              styleStr="display:flex;flex-direction:column;gap:8px;padding:15px 16px;border-radius:15px;cursor:pointer;text-align:right;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#eaf2ff;transition:all .2s ease;"
              hoverStr="background:rgba(22,122,254,.14);border-color:rgba(22,122,254,.6);transform:translateY(-2px);"
            >
              <span
                style={css(
                  'align-self:flex-start;font-size:.64rem;font-weight:700;padding:.2rem .5rem;border-radius:99px;background:rgba(22,122,254,.22);border:1px solid rgba(22,122,254,.4);color:#bcd9ff;',
                )}
              >
                {ex.tag}
              </span>
              <span style={css('font-size:.92rem;line-height:1.65;')}>{ex.text}</span>
            </HoverButton>
          ))}
        </div>
      </div>
    )
  }

  renderMessages(messages: Msg[]): ReactNode {
    const prompts = messages.filter((m) => m.role === 'assistant' && m.kind === 'prompt')
    const lastPromptId = prompts.length ? prompts[prompts.length - 1].id : -1
    return (
      <div
        style={css(
          'max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding-bottom:14px;',
        )}
      >
        {messages.map((m) => (
          <div key={m.id}>{this.renderMessage(m, m.id === lastPromptId)}</div>
        ))}
      </div>
    )
  }

  renderMessage(m: Msg, isLast: boolean): ReactNode {
    if (m.role === 'user' && m.kind === 'text') {
      const hasText = !!(m.text && m.text.trim())
      return (
        <div style={css('display:flex;justify-content:flex-start;')}>
          <div
            style={css(
              'max-width:82%;padding:12px 16px;border-radius:18px 18px 6px 18px;font-size:.96rem;line-height:1.7;color:#fff;background:linear-gradient(180deg,#2488ff,#1460ca);border:1px solid #167afe;box-shadow:inset 0 0 40px rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px;',
            )}
          >
            {m.image && (
              <img
                src={m.image}
                alt="تصویر پیوست"
                style={css(
                  'display:block;max-width:240px;max-height:240px;border-radius:11px;border:1px solid rgba(255,255,255,.25);',
                )}
              />
            )}
            {hasText && <div>{m.text}</div>}
          </div>
        </div>
      )
    }
    if (m.kind === 'loading') {
      return (
        <div style={css('display:flex;align-items:center;gap:11px;color:rgba(245,250,255,.7);font-size:.9rem;')}>
          <span style={css('display:inline-flex;gap:5px;align-items:flex-end;')}>
            <span style={css('width:7px;height:7px;border-radius:99px;background:#60b0ff;animation:mrcDot 1.2s infinite;')} />
            <span style={css('width:7px;height:7px;border-radius:99px;background:#60b0ff;animation:mrcDot 1.2s .2s infinite;')} />
            <span style={css('width:7px;height:7px;border-radius:99px;background:#60b0ff;animation:mrcDot 1.2s .4s infinite;')} />
          </span>
          {m.loadingText}
        </div>
      )
    }
    if (m.kind === 'error') {
      return (
        <div
          style={css(
            'display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:14px;background:rgba(255,176,31,.1);border:1px solid rgba(255,176,31,.4);color:#ffe2ad;font-size:.92rem;line-height:1.7;',
          )}
        >
          {m.text}
        </div>
      )
    }
    // prompt card
    const promptDir = m.promptLang === 'en' ? 'ltr' : 'rtl'
    const promptAlign = m.promptLang === 'en' ? 'left' : 'right'
    const hasTips = !!(m.tips && m.tips.length)
    return (
      <div
        style={css(
          'background:rgba(22,122,254,.1);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:inset 0 0 64px rgba(21,21,29,.4);padding:16px 17px;',
        )}
      >
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px;')}>
          <div style={css('display:flex;align-items:center;gap:10px;min-width:0;')}>
            <div
              style={css(
                'flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:rgba(22,122,254,.22);border:1px solid rgba(255,255,255,.14);',
              )}
            >
              <img src="/assets/logo-mark-dark.svg" alt="" style={css('width:17px;height:17px;')} />
            </div>
            <strong
              style={css('font-size:.98rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}
            >
              {m.title}
            </strong>
          </div>
          <HoverButton
            onClick={() => this.copy(m.prompt || '', m.copyToast)}
            styleStr="flex:none;display:inline-flex;align-items:center;gap:6px;padding:.42rem .75rem;border-radius:10px;font-size:.8rem;font-weight:600;cursor:pointer;color:#eaf2ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);"
            hoverStr="background:rgba(255,255,255,.2);"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" />
              <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {m.copyLabel || 'کپی'}
          </HoverButton>
        </div>
        <div
          dir={promptDir}
          style={{
            ...css(
              'background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:15px 17px;white-space:pre-wrap;line-height:1.9;font-size:.95rem;color:#e8f1ff;',
            ),
            textAlign: promptAlign as 'left' | 'right',
          }}
        >
          {m.prompt}
        </div>
        {hasTips && (
          <div style={css('margin-top:13px;display:flex;flex-direction:column;gap:7px;')}>
            {m.tips!.map((tip, i) => (
              <div
                key={i}
                style={css(
                  'display:flex;gap:8px;align-items:flex-start;font-size:.85rem;line-height:1.6;color:rgba(245,250,255,.78);',
                )}
              >
                <span style={css('flex:none;margin-top:2px;color:#60b0ff;')}>✓</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}
        {isLast && (
          <div
            style={css(
              'margin-top:15px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:8px;',
            )}
          >
            <span style={css('font-size:.78rem;color:rgba(245,250,255,.5);align-self:center;margin-left:2px;')}>
              اصلاح:
            </span>
            {cfg[this.state.activeBot].refines.map((r, i) => (
              <HoverButton
                key={i}
                onClick={() => this.refine(m, r)}
                styleStr="padding:.36rem .72rem;border-radius:99px;font-size:.8rem;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);"
                hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);"
              >
                {r.label}
              </HoverButton>
            ))}
          </div>
        )}
      </div>
    )
  }

  renderComposer(c: (typeof cfg)[BotId], settingsSummary: string): ReactNode {
    const pendingImage = this.state.pendingImage
    const sendDisabled = this.state.busy || !((this.state.input || '').trim() || this.state.pendingImage)
    return (
      <div style={css('flex:none;padding:10px 22px 20px;background:linear-gradient(0deg,#101424 60%,transparent);')}>
        <div style={css('max-width:760px;margin:0 auto;')}>
          <div
            style={css(
              'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:9px 10px 9px 12px;box-shadow:0 12px 28px rgba(6,24,66,.35);',
            )}
          >
            {pendingImage && (
              <div
                style={css(
                  'display:flex;align-items:center;gap:10px;margin:2px 4px 9px;padding:6px;border-radius:14px;background:rgba(8,12,24,.55);border:1px solid rgba(255,255,255,.1);width:max-content;max-width:100%;',
                )}
              >
                <img
                  src={pendingImage.dataURL}
                  alt="پیش‌نمایش"
                  style={css(
                    'width:46px;height:46px;object-fit:cover;border-radius:9px;border:1px solid rgba(255,255,255,.18);',
                  )}
                />
                <span style={css('font-size:.78rem;color:rgba(245,250,255,.72);')}>
                  {pendingImage.isVideo ? 'فریمِ ویدیو پیوست شد' : 'تصویر پیوست شد'}
                </span>
                <HoverButton
                  onClick={() => this.clearImage()}
                  aria-label="حذف تصویر"
                  styleStr="width:26px;height:26px;display:grid;place-items:center;border-radius:8px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);"
                  hoverStr="background:rgba(255,255,255,.18);"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </HoverButton>
              </div>
            )}
            <div style={css('display:flex;align-items:flex-end;gap:6px;')}>
              <input
                ref={(el) => {
                  this.fileEl = el
                }}
                type="file"
                accept="image/*"
                onChange={(e) => this.onPickImage(e)}
                style={css('display:none;')}
              />
              <input
                ref={(el) => {
                  this.videoEl = el
                }}
                type="file"
                accept="video/*"
                onChange={(e) => this.onPickVideo(e)}
                style={css('display:none;')}
              />
              <HoverButton
                onClick={() => this.openFilePicker()}
                aria-label="پیوست تصویر"
                title="پیوست تصویر"
                styleStr="flex:none;width:42px;height:42px;display:grid;place-items:center;border-radius:13px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);transition:all .18s ease;"
                hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);color:#fff;"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="8.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M4 16.5l4.5-4 3 2.6 3.5-3.3L20 16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </HoverButton>
              <HoverButton
                onClick={() => this.openVideoPicker()}
                aria-label="پیوست ویدیو"
                title="پیوست ویدیو"
                styleStr="flex:none;width:42px;height:42px;display:grid;place-items:center;border-radius:13px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);transition:all .18s ease;"
                hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);color:#fff;"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 10l5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </HoverButton>
              <button
                onClick={() => this.toggleDictation()}
                aria-label="گفتن به‌جای نوشتن"
                title="گفتن به‌جای نوشتن"
                style={css(this.micBtnStyle(this.state.listening))}
              >
                {this.state.listening && (
                  <span
                    style={css(
                      'position:absolute;inset:-3px;border-radius:14px;border:2px solid rgba(255,80,80,.55);animation:mrcRing 1.1s ease-out infinite;pointer-events:none;',
                    )}
                  />
                )}
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={css('position:relative;z-index:1;')}
                >
                  <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <textarea
                value={this.state.input}
                onChange={(e) => this.onInput(e)}
                onKeyDown={(e) => this.onKey(e)}
                rows={1}
                placeholder={c.placeholder}
                style={css(
                  'flex:1;min-width:0;resize:none;max-height:160px;background:transparent;border:0;outline:none;color:#f7fbff;font-family:inherit;font-size:1rem;line-height:1.7;padding:8px 6px;',
                )}
              />
              <HoverButton
                onClick={() => this.send()}
                disabled={sendDisabled}
                aria-label="ارسال"
                styleStr="flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);transition:all .2s ease;"
                hoverStr="filter:brightness(1.08);transform:translateY(-1px);"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 19V5M12 5l-6 6M12 5l6 6"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </HoverButton>
            </div>
          </div>
          <div style={css('margin-top:9px;text-align:center;font-size:.74rem;color:rgba(245,250,255,.42);')}>
            {settingsSummary} &middot; برای ارسال Enter بزن
          </div>
        </div>
      </div>
    )
  }

  renderSidebar(botId: BotId, c: (typeof cfg)[BotId]): ReactNode {
    return (
      <aside
        style={css(
          'grid-row:1;min-height:0;overflow-y:auto;border-right:1px solid rgba(255,255,255,.07);background:rgba(15,15,29,.4);backdrop-filter:blur(14px);padding:20px 18px;display:flex;flex-direction:column;gap:22px;',
        )}
      >
        <div style={css('display:flex;flex-direction:column;gap:18px;')}>
          {GROUPS.map((g, gi) => (
            <div key={gi}>
              <div
                style={css(
                  'font-size:.7rem;letter-spacing:.04em;color:rgba(245,250,255,.5);margin-bottom:10px;font-weight:600;',
                )}
              >
                {g.label}
              </div>
              <div style={css('display:flex;flex-direction:column;gap:8px;')}>
                {g.ids.map((id) => this.renderBotButton(id, id === botId))}
              </div>
            </div>
          ))}
        </div>

        <div style={css('height:1px;background:rgba(255,255,255,.08);')} />

        <div>
          <div
            style={css(
              'font-size:.7rem;letter-spacing:.04em;color:rgba(245,250,255,.5);margin-bottom:12px;font-weight:600;',
            )}
          >
            تنظیمات خروجی
          </div>
          <div style={css('display:flex;flex-direction:column;gap:17px;')}>
            {c.fields.map((f, fi) => (
              <div key={fi}>
                <div style={css('font-size:.78rem;color:rgba(245,250,255,.72);margin-bottom:8px;font-weight:600;')}>
                  {f.label}
                </div>
                <div style={css('display:flex;flex-wrap:wrap;gap:7px;')}>
                  {f.options.map((o, oi) => {
                    const active = this.state.bots[botId].settings[f.key] === o.v
                    return (
                      <button
                        key={oi}
                        onClick={() => this.setSetting(f.key, o.v)}
                        style={css(
                          'position:relative;padding:.44rem .7rem;border-radius:11px;font-size:.8rem;font-weight:600;cursor:pointer;color:#eef5ff;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);',
                        )}
                      >
                        {active && (
                          <span
                            style={css(
                              'position:absolute;inset:-1px;border-radius:11px;border:1px solid rgba(22,122,254,.75);background:rgba(22,122,254,.28);pointer-events:none;',
                            )}
                          />
                        )}
                        <span style={css('position:relative;z-index:1;')}>{o.l || o.v}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={css('margin-top:auto;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);')}>
          <p style={css('margin:0 0 12px;font-size:.78rem;line-height:1.75;color:rgba(245,250,255,.6);')}>
            دستیارت رو از بالا عوض کن؛ هر کدوم تنظیمات و گفت‌وگوی خودش رو داره.
          </p>
          <div style={css('display:flex;gap:9px;')}>
            <span
              style={css(
                'width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);',
              )}
            >
              <img src="/assets/telegram.svg" alt="تلگرام" style={css('width:18px;height:18px;')} />
            </span>
            <span
              style={css(
                'width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);',
              )}
            >
              <img src="/assets/instagram.svg" alt="اینستاگرام" style={css('width:18px;height:18px;')} />
            </span>
          </div>
        </div>
      </aside>
    )
  }

  renderBotButton(id: BotId, active: boolean): ReactNode {
    return (
      <button
        key={id}
        onClick={() => this.switchBot(id)}
        style={css(
          'position:relative;display:flex;align-items:center;gap:10px;text-align:right;padding:10px 11px;border-radius:13px;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);transition:all .18s ease;',
        )}
      >
        {active && (
          <span
            style={css(
              'position:absolute;inset:-1px;border-radius:13px;border:1px solid rgba(22,122,254,.7);background:rgba(22,122,254,.16);box-shadow:inset 0 0 30px rgba(22,122,254,.18);pointer-events:none;',
            )}
          />
        )}
        <span
          style={css(
            'position:relative;z-index:1;flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#9ecbff;',
          )}
        >
          {this.botIcon(id)}
        </span>
        <span style={css('position:relative;z-index:1;display:flex;flex-direction:column;line-height:1.32;min-width:0;')}>
          <strong style={css('font-size:.9rem;font-weight:700;')}>{cfg[id].name}</strong>
          <span
            style={css(
              'font-size:.7rem;color:rgba(245,250,255,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
            )}
          >
            {cfg[id].tagline}
          </span>
        </span>
      </button>
    )
  }

  botIcon(id: BotId): ReactNode {
    switch (id) {
      case 'prompt':
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )
      case 'formal':
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h8l4 4v14H6V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M9 12h6M9 16h6M9 8h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )
      case 'insta':
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="6.5" width="17" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="13" r="3.1" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 6.5l1.2-2h5.6L16 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        )
      case 'english':
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M3.5 12h17M12 3.5c2.4 2.3 2.4 14.7 0 17M12 3.5c-2.4 2.3-2.4 14.7 0 17"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )
      case 'study':
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 4L2.5 9 12 14l9.5-5L12 4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path
              d="M6 11.2V15c0 1.1 2.7 2.4 6 2.4s6-1.3 6-2.4v-3.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
    }
  }

  renderTasks(): ReactNode {
    const draft = this.state.taskDraft
    const repeatOptions: { v: Repeat; l: string }[] = [
      { v: 'once', l: 'یک‌بار' },
      { v: 'daily', l: 'روزانه' },
      { v: 'hourly', l: 'هر ساعت' },
      { v: 'weekly', l: 'هفتگی' },
    ]
    const repeatLabelMap: Record<Repeat, string> = {
      once: 'یک‌بار',
      daily: 'روزانه',
      hourly: 'هر ساعت',
      weekly: 'هفتگی',
    }
    return (
      <div
        style={css(
          'position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto;background:radial-gradient(circle at 50% 0%,rgba(22,122,254,.18),transparent 55%),rgba(8,10,20,.86);backdrop-filter:blur(16px);',
        )}
      >
        <div
          style={css(
            'position:relative;width:min(560px,96vw);padding:26px 22px;border-radius:24px;background:rgba(15,17,32,.74);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;gap:18px;',
          )}
        >
          <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;')}>
            <div style={css('display:flex;align-items:center;gap:11px;')}>
              <div
                style={css(
                  'width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);color:#9ecbff;',
                )}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M12 8.5v4.2l2.6 1.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </div>
              <div style={css('display:flex;flex-direction:column;line-height:1.3;')}>
                <strong style={css('font-size:1.05rem;font-weight:800;')}>کارهای زمان‌بندی‌شده</strong>
                <span style={css('font-size:.72rem;color:rgba(245,250,255,.55);')}>
                  دستیارها به‌صورتِ خودکار برات کار می‌کنن
                </span>
              </div>
            </div>
            <HoverButton
              onClick={() => this.closeTasks()}
              aria-label="بستن"
              styleStr="width:34px;height:34px;display:grid;place-items:center;border-radius:10px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);"
              hoverStr="background:rgba(255,255,255,.16);"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </HoverButton>
          </div>

          <div
            style={css(
              'background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:13px;',
            )}
          >
            <div style={css('font-size:.78rem;font-weight:600;color:rgba(245,250,255,.7);')}>کارِ جدید</div>
            <div style={css('display:flex;flex-wrap:wrap;gap:6px;')}>
              {ORDER.map((id) => {
                const active = draft.botId === id
                return (
                  <button
                    key={id}
                    onClick={() => this.setDraft('botId', id)}
                    style={css(
                      'position:relative;padding:.4rem .7rem;border-radius:10px;font-size:.78rem;font-weight:600;cursor:pointer;color:#eef5ff;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);',
                    )}
                  >
                    {active && (
                      <span
                        style={css(
                          'position:absolute;inset:-1px;border-radius:10px;border:1px solid rgba(22,122,254,.75);background:rgba(22,122,254,.28);pointer-events:none;',
                        )}
                      />
                    )}
                    <span style={css('position:relative;z-index:1;')}>{cfg[id].name}</span>
                  </button>
                )
              })}
            </div>
            <textarea
              value={draft.input}
              onChange={(e) => this.setDraft('input', e.target.value)}
              rows={2}
              placeholder="چه کاری انجام بشه؟ مثلاً «۳ تا هوکِ اینستاگرام درباره‌ی هوش مصنوعی»"
              style={css(
                'width:100%;box-sizing:border-box;resize:none;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:12px;color:#f7fbff;font-family:inherit;font-size:.92rem;line-height:1.7;padding:10px 12px;outline:none;',
              )}
            />
            <div style={css('display:flex;gap:6px;')}>
              {repeatOptions.map((r) => (
                <button
                  key={r.v}
                  onClick={() => this.setDraft('repeat', r.v)}
                  style={css(this.taskRepeatStyle(draft.repeat === r.v))}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <div style={css('display:flex;align-items:center;gap:12px;')}>
              {draft.repeat === 'hourly' ? (
                <span style={css('font-size:.78rem;color:rgba(245,250,255,.5);')}>از همین حالا هر ساعت اجرا می‌شه</span>
              ) : (
                <div style={css('display:flex;align-items:center;gap:8px;')}>
                  <span style={css('font-size:.8rem;color:rgba(245,250,255,.7);')}>ساعت</span>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => this.setDraft('time', e.target.value)}
                    style={css(
                      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:10px;color:#f7fbff;font-family:inherit;font-size:.9rem;padding:6px 10px;outline:none;',
                    )}
                  />
                </div>
              )}
              <HoverButton
                onClick={() => this.addTask()}
                styleStr="margin-right:auto;display:inline-flex;align-items:center;gap:7px;padding:.55rem 1.1rem;border-radius:12px;font-weight:600;font-size:.86rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);"
                hoverStr="filter:brightness(1.06);"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                افزودن
              </HoverButton>
            </div>
          </div>

          {this.state.tasks.length > 0 ? (
            <div style={css('display:flex;flex-direction:column;gap:11px;')}>
              {this.state.tasks.map((t) => this.renderTaskCard(t, repeatLabelMap))}
            </div>
          ) : (
            <div
              style={css(
                'text-align:center;padding:18px 10px;color:rgba(245,250,255,.5);font-size:.86rem;line-height:1.8;',
              )}
            >
              هنوز کاری زمان‌بندی نکردی.
              <br />
              یه کارِ تکرارشونده بساز تا دستیار خودش هر روز برات انجامش بده.
            </div>
          )}
        </div>
      </div>
    )
  }

  renderTaskCard(t: Task, repeatLabelMap: Record<Repeat, string>): ReactNode {
    const repeatLabel = repeatLabelMap[t.repeat] || t.repeat
    const scheduleLabel = repeatLabel + (t.repeat === 'hourly' ? '' : ' · ' + this.faDigits(t.time))
    const toggleStyle =
      'position:relative;width:38px;height:22px;border-radius:99px;cursor:pointer;border:1px solid ' +
      (t.enabled ? 'rgba(22,122,254,.7)' : 'rgba(255,255,255,.2)') +
      ';background:' +
      (t.enabled ? 'rgba(22,122,254,.5)' : 'rgba(255,255,255,.08)') +
      ';transition:all .18s ease;'
    const knobStyle =
      'position:absolute;top:2px;' +
      (t.enabled ? 'left:2px' : 'right:2px') +
      ';width:16px;height:16px;border-radius:50%;background:#fff;transition:all .18s ease;'
    return (
      <div
        key={t.id}
        style={css(
          'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:15px;padding:13px 14px;display:flex;flex-direction:column;gap:10px;',
        )}
      >
        <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:10px;')}>
          <div style={css('display:flex;flex-direction:column;gap:4px;min-width:0;')}>
            <div style={css('display:flex;align-items:center;gap:7px;')}>
              <span
                style={css(
                  'font-size:.66rem;font-weight:700;padding:.16rem .5rem;border-radius:99px;background:rgba(22,122,254,.22);border:1px solid rgba(22,122,254,.4);color:#bcd9ff;',
                )}
              >
                {cfg[t.botId] ? cfg[t.botId].name : t.botId}
              </span>
              <span style={css('font-size:.72rem;color:rgba(245,250,255,.5);')}>{scheduleLabel}</span>
            </div>
            <div style={css('font-size:.9rem;color:#eaf2ff;line-height:1.6;')}>{t.input}</div>
          </div>
          <button onClick={() => this.toggleTask(t.id)} aria-label="فعال/خاموش" style={css(toggleStyle)}>
            <span style={css(knobStyle)} />
          </button>
        </div>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;')}>
          <span style={css('font-size:.74rem;color:rgba(245,250,255,.55);')}>
            اجرای بعدی: {t.enabled ? this.formatNext(t.nextRun) : 'خاموش'}
          </span>
          <HoverButton
            onClick={() => this.runTask(t.id)}
            styleStr="margin-right:auto;display:inline-flex;align-items:center;gap:5px;padding:.32rem .7rem;border-radius:9px;font-size:.76rem;font-weight:600;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);"
            hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);"
          >
            {t.status === 'running' ? 'در حال اجرا…' : 'همین حالا اجرا کن'}
          </HoverButton>
          <HoverButton
            onClick={() => this.deleteTask(t.id)}
            aria-label="حذف"
            styleStr="width:30px;height:30px;display:grid;place-items:center;border-radius:9px;cursor:pointer;color:rgba(255,160,160,.9);background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.28);"
            hoverStr="background:rgba(255,80,80,.2);"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 7h14M10 7V5h4v2M9 7l.7 12h4.6L15 7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </HoverButton>
        </div>
        {t.lastResult && (
          <div
            style={css(
              'background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:11px 12px;',
            )}
          >
            <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;')}>
              <strong style={css('font-size:.82rem;font-weight:700;color:#eaf2ff;')}>{t.lastResult.title}</strong>
              <HoverButton
                onClick={() => this.copy(t.lastResult!.prompt, 'کپی شد ✓')}
                styleStr="display:inline-flex;align-items:center;gap:5px;padding:.28rem .6rem;border-radius:8px;font-size:.72rem;font-weight:600;cursor:pointer;color:#eaf2ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);"
                hoverStr="background:rgba(255,255,255,.2);"
              >
                کپی
              </HoverButton>
            </div>
            <div
              style={css(
                'font-size:.84rem;line-height:1.8;color:rgba(245,250,255,.82);white-space:pre-wrap;max-height:150px;overflow:auto;',
              )}
            >
              {t.lastResult.prompt}
            </div>
          </div>
        )}
      </div>
    )
  }

  renderVoice(botName: string): ReactNode {
    const vs = this.state.voiceState
    const statusText = {
      idle: 'بزن و شروع کن به حرف زدن',
      listening: 'دارم گوش می‌دم… برای پایان دوباره بزن',
      thinking: 'دارم فکر می‌کنم…',
      speaking: 'در حال پاسخ… برای قطع بزن',
    }[vs]
    return (
      <div
        style={css(
          'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 28%,rgba(22,122,254,.22),transparent 60%),rgba(8,10,20,.86);backdrop-filter:blur(16px);',
        )}
      >
        <div
          style={css(
            'position:relative;width:min(520px,94vw);padding:30px 26px 26px;border-radius:26px;background:rgba(15,17,32,.72);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(7,17,47,.55);display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;',
          )}
        >
          <HoverButton
            onClick={() => this.closeVoiceMode()}
            aria-label="بستن"
            styleStr="position:absolute;top:14px;left:14px;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);"
            hoverStr="background:rgba(255,255,255,.16);"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </HoverButton>
          <div style={css('display:flex;flex-direction:column;align-items:center;gap:6px;')}>
            <div
              style={css(
                'width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 40px rgba(22,122,254,.4);',
              )}
            >
              <img src="/assets/logo-mark-dark.svg" alt="" style={css('width:26px;height:26px;')} />
            </div>
            <strong style={css('font-size:1.05rem;font-weight:800;')}>گفت‌وگوی صوتی</strong>
            <span style={css('font-size:.74rem;color:rgba(245,250,255,.55);')}>با {botName}</span>
          </div>
          <div
            ref={(el) => this.setVizRef(el)}
            style={css('height:90px;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;')}
          />
          {this.state.voiceTranscript && (
            <div style={css('font-size:.95rem;color:#eaf2ff;line-height:1.7;')}>«{this.state.voiceTranscript}»</div>
          )}
          {this.state.voiceReply && (
            <div
              style={css(
                'font-size:.95rem;color:rgba(245,250,255,.85);line-height:1.85;background:rgba(8,12,24,.5);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;max-height:170px;overflow:auto;width:100%;box-sizing:border-box;',
              )}
            >
              {this.state.voiceReply}
            </div>
          )}
          <button
            onClick={() => this.voiceTurn()}
            aria-label="شروع/پایانِ صحبت"
            style={css(this.voiceBtnStyle(vs))}
          >
            {vs === 'listening' && (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
              </svg>
            )}
            {vs === 'thinking' && (
              <span style={css('display:inline-flex;gap:6px;')}>
                <span style={css('width:9px;height:9px;border-radius:99px;background:#fff;animation:mrcDot 1.2s infinite;')} />
                <span style={css('width:9px;height:9px;border-radius:99px;background:#fff;animation:mrcDot 1.2s .2s infinite;')} />
                <span style={css('width:9px;height:9px;border-radius:99px;background:#fff;animation:mrcDot 1.2s .4s infinite;')} />
              </span>
            )}
            {vs === 'speaking' && (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                <path d="M16 8.5a4 4 0 0 1 0 7M18.6 6a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
            {vs === 'idle' && (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
                <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <div style={css('font-size:.82rem;color:rgba(245,250,255,.72);min-height:1.2em;')}>{statusText}</div>
          <button onClick={() => this.toggleSpeakReplies()} style={css(this.speakChipStyle(this.state.speakReplies))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            </svg>
            پاسخِ صوتی
          </button>
        </div>
      </div>
    )
  }
}
