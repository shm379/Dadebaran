import { useCallback, useRef, useState } from 'react'
import { useToast } from '../state/ToastProvider'

function getSR(): SpeechRecognitionLike | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  return SR ? new SR() : null
}

/**
 * Composer speech-to-text. Appends recognized Persian text to the current
 * input (read via getInput) and streams updates through setInput.
 */
export function useDictation(getInput: () => string, setInput: (v: string) => void) {
  const { showToast } = useToast()
  const [listening, setListening] = useState(false)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  const baseRef = useRef('')

  const toggle = useCallback(() => {
    if (listening) {
      try {
        recogRef.current?.stop()
      } catch {
        /* ignore */
      }
      return
    }
    const r = getSR()
    if (!r) {
      showToast('مرورگرت از تبدیلِ گفتار به متن پشتیبانی نمی‌کنه')
      return
    }
    r.lang = 'fa-IR'
    r.interimResults = true
    r.continuous = false
    baseRef.current = getInput() ? getInput() + ' ' : ''
    r.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(baseRef.current + t)
    }
    r.onerror = () => setListening(false)
    r.onend = () => {
      setListening(false)
      recogRef.current = null
    }
    recogRef.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
    }
  }, [listening, getInput, setInput, showToast])

  return { listening, toggle }
}
