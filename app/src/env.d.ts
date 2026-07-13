// Ambient declarations for the browser speech / audio APIs used by the app
// that aren't in the standard TS DOM lib.
export {}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
    webkitAudioContext?: typeof AudioContext
  }

  type SpeechRecognitionCtor = new () => SpeechRecognitionLike

  interface SpeechRecognitionLike {
    lang: string
    interimResults: boolean
    continuous: boolean
    onresult: ((e: SpeechRecognitionEventLike) => void) | null
    onerror: ((e: unknown) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
  }

  interface SpeechRecognitionEventLike {
    results: ArrayLike<ArrayLike<{ transcript: string }>>
  }
}
