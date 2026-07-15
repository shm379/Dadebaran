import { useEffect, useRef } from 'react'
import { css } from '../css'
import { useChat } from '../state/ChatProvider'
import { Hero } from './Hero'
import { MessageItem } from './MessageItem'

export function ChatArea() {
  const { activeBot, messages } = useChat()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el && messages.length) el.scrollTop = el.scrollHeight
  }, [messages, activeBot])

  const prompts = messages.filter((m) => m.role === 'assistant' && m.kind === 'prompt')
  const lastPromptId = prompts.length ? prompts[prompts.length - 1].id : -1

  return (
    <div ref={scrollRef} style={css('flex:1;min-height:0;overflow-y:auto;padding:26px 22px 8px;')}>
      {messages.length === 0 ? (
        <Hero />
      ) : (
        <div style={css('max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding-bottom:14px;')}>
          {messages.map((m) => (
            <div key={m.id}>
              <MessageItem m={m} isLast={m.id === lastPromptId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
