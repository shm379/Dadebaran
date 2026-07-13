/**
 * Client for the live model call. Mirrors the prototype's
 * `window.claude.complete({ messages })` contract: takes chat messages
 * (content may be a plain string or an array of Anthropic content blocks)
 * and resolves to the assistant's text.
 *
 * Requests are proxied through `/api/complete` so the Anthropic key stays on
 * the server. When no key is configured the server answers 503, and we throw
 * `Error('no-api')` — the exact signal the UI uses to show its Persian
 * "open me in a real runtime" fallback, preserving the prototype's behavior.
 */

export type TextBlock = { type: 'text'; text: string }
export type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}
export type ContentBlock = TextBlock | ImageBlock
export type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

export const claude = {
  async complete({ messages }: { messages: Message[] }): Promise<string> {
    let res: Response
    try {
      res = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
    } catch {
      throw new Error('no-api')
    }
    if (res.status === 503) throw new Error('no-api')
    if (!res.ok) throw new Error('http-' + res.status)
    const data = (await res.json()) as { text?: string; error?: string }
    if (typeof data.text !== 'string') throw new Error(data.error || 'bad-response')
    return data.text
  },
}
