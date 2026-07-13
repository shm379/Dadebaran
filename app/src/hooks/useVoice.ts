import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from '../state/ChatProvider'
import { useToast } from '../state/ToastProvider'
import type { VoiceState } from '../types'

function getSR(): SpeechRecognitionLike | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  return SR ? new SR() : null
}

const STATUS: Record<VoiceState, string> = {
  idle: 'بزن و شروع کن به حرف زدن',
  listening: 'دارم گوش می‌دم… برای پایان دوباره بزن',
  thinking: 'دارم فکر می‌کنم…',
  speaking: 'در حال پاسخ… برای قطع بزن',
}

/** The voice-conversation state machine: listen → think → speak, with a live
 *  microphone-frequency visualizer. Self-cleans on unmount. */
export function useVoice() {
  const { completeRaw } = useChat()
  const { showToast } = useToast()

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [speakReplies, setSpeakReplies] = useState(true)

  const vrecog = useRef<SpeechRecognitionLike | null>(null)
  const bars = useRef<HTMLDivElement[]>([])
  const audioCtx = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const micStream = useRef<MediaStream | null>(null)
  const vizData = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const vizRAF = useRef<number | null>(null)
  const stateRef = useRef<VoiceState>('idle')
  const speakRef = useRef(true)
  stateRef.current = voiceState
  speakRef.current = speakReplies

  const stopViz = useCallback(() => {
    if (vizRAF.current) cancelAnimationFrame(vizRAF.current)
    vizRAF.current = null
    analyser.current = null
    if (audioCtx.current) {
      try {
        audioCtx.current.close()
      } catch {
        /* ignore */
      }
      audioCtx.current = null
    }
    if (micStream.current) {
      try {
        micStream.current.getTracks().forEach((t) => t.stop())
      } catch {
        /* ignore */
      }
      micStream.current = null
    }
    bars.current.forEach((b) => (b.style.height = '8px'))
  }, [])

  const stopAll = useCallback(() => {
    if (vrecog.current) {
      try {
        vrecog.current.stop()
      } catch {
        /* ignore */
      }
      vrecog.current = null
    }
    stopViz()
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* ignore */
    }
  }, [stopViz])

  useEffect(() => stopAll, [stopAll]) // cleanup on unmount

  const idleViz = useCallback(() => {
    let t = 0
    const loop = () => {
      if (stateRef.current !== 'listening') return
      t += 0.16
      bars.current.forEach((b, i) => (b.style.height = 8 + Math.abs(Math.sin(t + i * 0.4)) * 42 + 'px'))
      vizRAF.current = requestAnimationFrame(loop)
    }
    loop()
  }, [])

  const startViz = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        idleViz()
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStream.current = stream
      const Ctx = window.AudioContext || window.webkitAudioContext!
      audioCtx.current = new Ctx()
      const src = audioCtx.current.createMediaStreamSource(stream)
      analyser.current = audioCtx.current.createAnalyser()
      analyser.current.fftSize = 64
      src.connect(analyser.current)
      vizData.current = new Uint8Array(analyser.current.frequencyBinCount)
      const loop = () => {
        if (!analyser.current) return
        analyser.current.getByteFrequencyData(vizData.current!)
        bars.current.forEach((b, i) => {
          const v = vizData.current![i % vizData.current!.length] / 255
          b.style.height = 8 + Math.round(v * 74) + 'px'
        })
        vizRAF.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      idleViz()
    }
  }, [idleViz])

  const speak = useCallback((text: string) => {
    try {
      const synth = window.speechSynthesis
      if (!synth) {
        setVoiceState('idle')
        return
      }
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'fa-IR'
      u.rate = 1
      u.pitch = 1
      const fa = (synth.getVoices() || []).find((v) => /fa|persian|فارس/i.test((v.lang || '') + (v.name || '')))
      if (fa) u.voice = fa
      u.onend = () => setVoiceState((s) => (s === 'speaking' ? 'idle' : s))
      u.onerror = () => setVoiceState((s) => (s === 'speaking' ? 'idle' : s))
      synth.speak(u)
    } catch {
      setVoiceState('idle')
    }
  }, [])

  const handleQuery = useCallback(
    async (text: string) => {
      setVoiceState('thinking')
      try {
        const sys =
          'تو یک دستیارِ صوتیِ فارسی‌زبانِ گرم و خودمونی هستی. کوتاه و محاوره‌ای جواب بده (حداکثر چند جمله)، طوری که وقتی بلند خونده بشه طبیعی باشه. بدونِ مارک‌داون و بدونِ ایموجی.'
        const raw = await completeRaw([{ role: 'user', content: sys + '\n\nکاربر گفت: «' + text + '»\n\nپاسخِ کوتاهِ صوتی:' }])
        const clean = (raw || '').trim()
        setReply(clean)
        if (speakRef.current) {
          setVoiceState('speaking')
          speak(clean)
        } else {
          setVoiceState('idle')
        }
      } catch {
        setReply('نشد جواب بدم؛ دوباره امتحان کن.')
        setVoiceState('idle')
      }
    },
    [completeRaw, speak],
  )

  const startTurn = useCallback(() => {
    const r = getSR()
    if (!r) {
      showToast('مرورگرت از گفت‌وگوی صوتی پشتیبانی نمی‌کنه')
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
      setTranscript(t)
    }
    r.onerror = () => {
      stopViz()
      setVoiceState('idle')
    }
    r.onend = () => {
      vrecog.current = null
      stopViz()
      const txt = (finalT || '').trim()
      if (txt) handleQuery(txt)
      else setVoiceState('idle')
    }
    vrecog.current = r
    setReply('')
    setTranscript('')
    setVoiceState('listening')
    startViz()
    try {
      r.start()
    } catch {
      stopViz()
      setVoiceState('idle')
    }
  }, [showToast, stopViz, startViz, handleQuery])

  const voiceTurn = useCallback(() => {
    const s = stateRef.current
    if (s === 'listening') {
      try {
        vrecog.current?.stop()
      } catch {
        /* ignore */
      }
      return
    }
    if (s === 'speaking') {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
      setVoiceState('idle')
      return
    }
    if (s === 'thinking') return
    startTurn()
  }, [startTurn])

  const setVizRef = useCallback((el: HTMLDivElement | null) => {
    if (el && !el.childElementCount) {
      el.innerHTML = ''
      bars.current = []
      for (let i = 0; i < 32; i++) {
        const b = document.createElement('div')
        b.style.cssText =
          'width:5px;height:8px;border-radius:99px;background:linear-gradient(180deg,#7cc0ff,#167afe);transition:height .07s linear;'
        el.appendChild(b)
        bars.current.push(b)
      }
    }
  }, [])

  const toggleSpeakReplies = useCallback(() => setSpeakReplies((s) => !s), [])

  return {
    voiceState,
    transcript,
    reply,
    speakReplies,
    statusText: STATUS[voiceState],
    voiceTurn,
    toggleSpeakReplies,
    setVizRef,
  }
}
