// Model-call proxy. Primary target is NabuGate — the internal OpenAI-compatible
// gateway (POST {NABUGATE_URL}/v1/chat/completions, Bearer auth, model aliases
// like `nabu-fast`). If NabuGate isn't configured we fall back to the Anthropic
// Messages API, and if neither is configured we return 503 so the UI shows its
// Persian "not wired up yet" message.
//
// The frontend sends messages in Anthropic content-block shape
// ({type:'text'} / {type:'image',source:{type:'base64',media_type,data}}); we
// translate to OpenAI parts for NabuGate and pass through for Anthropic.

const NABUGATE_MODEL = process.env.NABUGATE_MODEL || 'nabu-fast'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || 1500)

// NABUGATE_URL is the full base, e.g. http://nabugate:8080. If only host/port
// are given (the "address and port" the operator sets), assemble it.
function nabugateBase() {
  const url = (process.env.NABUGATE_URL || '').trim().replace(/\/+$/, '')
  if (url) return url
  const host = (process.env.NABUGATE_HOST || '').trim()
  if (!host) return ''
  const port = (process.env.NABUGATE_PORT || '8080').trim()
  const scheme = host.startsWith('http') ? '' : 'http://'
  return `${scheme}${host}:${port}`.replace(/\/+$/, '')
}

function toOpenAIContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return String(content ?? '')
  return content.map((b) => {
    if (b && b.type === 'image' && b.source && b.source.type === 'base64') {
      return {
        type: 'image_url',
        image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` },
      }
    }
    if (b && b.type === 'text') return { type: 'text', text: b.text }
    return { type: 'text', text: typeof b === 'string' ? b : JSON.stringify(b) }
  })
}

async function callNabuGate(base, messages, model) {
  const openaiMessages = messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const headers = { 'content-type': 'application/json' }
  if (process.env.NABUGATE_API_KEY) headers.authorization = `Bearer ${process.env.NABUGATE_API_KEY}`

  let res
  try {
    res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: model || NABUGATE_MODEL, messages: openaiMessages, max_tokens: MAX_TOKENS }),
    })
  } catch (err) {
    return { status: 502, body: { error: 'nabugate-unreachable: ' + String(err) } }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { status: 502, body: { error: 'nabugate-' + res.status, detail } }
  }
  const data = await res.json().catch(() => ({}))
  const text = data?.choices?.[0]?.message?.content
  return { status: 200, body: { text: typeof text === 'string' ? text : '' } }
}

async function callAnthropic(messages) {
  const key = process.env.ANTHROPIC_API_KEY
  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: MAX_TOKENS, messages }),
    })
  } catch (err) {
    return { status: 502, body: { error: 'anthropic-unreachable: ' + String(err) } }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { status: 502, body: { error: 'anthropic-' + res.status, detail } }
  }
  const data = await res.json()
  const text = Array.isArray(data.content)
    ? data.content.filter((b) => b && b.type === 'text').map((b) => b.text).join('')
    : ''
  return { status: 200, body: { text } }
}

// ---- streaming ----

// Yield complete lines from a fetch Response body (SSE frames are line-based).
async function* responseLines(res, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      if (signal && signal.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (line) yield line
      }
    }
    if (buf.trim()) yield buf.trim()
  } finally {
    reader.cancel().catch(() => {})
  }
}

// `data: {...}` frames, terminated by `data: [DONE]`. Returns the JSON payloads.
async function* sseData(res, signal) {
  for await (const line of responseLines(res, signal)) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') return
    try {
      yield JSON.parse(payload)
    } catch {
      /* skip malformed frame */
    }
  }
}

async function streamNabuGate(base, messages, model, onDelta, signal) {
  const openaiMessages = messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) }))
  const headers = { 'content-type': 'application/json' }
  if (process.env.NABUGATE_API_KEY) headers.authorization = `Bearer ${process.env.NABUGATE_API_KEY}`

  let res
  try {
    res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: model || NABUGATE_MODEL,
        messages: openaiMessages,
        max_tokens: MAX_TOKENS,
        stream: true,
      }),
    })
  } catch (err) {
    if (signal && signal.aborted) return { status: 499, aborted: true }
    return { status: 502, error: 'nabugate-unreachable: ' + String(err) }
  }
  // Not OK, or not actually an event stream — let the caller fall back.
  if (!res.ok || !res.body) return { status: 502, error: 'nabugate-' + res.status, canFallback: true }

  try {
    for await (const frame of sseData(res, signal)) {
      const delta = frame?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) onDelta(delta)
    }
  } catch (err) {
    // A stop/disconnect aborts the upstream read; that isn't a failure.
    if (signal && signal.aborted) return { status: 499, aborted: true }
    return { status: 502, error: 'nabugate-stream-interrupted: ' + String(err) }
  }
  return { status: 200 }
}

async function streamAnthropic(messages, onDelta, signal) {
  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      signal,
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: MAX_TOKENS, messages, stream: true }),
    })
  } catch (err) {
    if (signal && signal.aborted) return { status: 499, aborted: true }
    return { status: 502, error: 'anthropic-unreachable: ' + String(err) }
  }
  if (!res.ok || !res.body) return { status: 502, error: 'anthropic-' + res.status, canFallback: true }

  try {
    for await (const frame of sseData(res, signal)) {
      if (frame?.type === 'content_block_delta' && typeof frame?.delta?.text === 'string') {
        onDelta(frame.delta.text)
      }
    }
  } catch (err) {
    if (signal && signal.aborted) return { status: 499, aborted: true }
    return { status: 502, error: 'anthropic-stream-interrupted: ' + String(err) }
  }
  return { status: 200 }
}

/**
 * Stream a completion, calling onDelta(chunk) as text arrives.
 *
 * Gateways that don't implement `stream: true` fail before emitting anything;
 * in that case we transparently fall back to the buffered call and deliver the
 * whole answer as a single delta, so streaming can never make chat worse than
 * it was before.
 *
 * @returns {Promise<{status:number, error?:string, aborted?:boolean}>}
 */
export async function streamComplete(body, onDelta, signal) {
  const messages = body && Array.isArray(body.messages) ? body.messages : null
  if (!messages || !messages.length) return { status: 400, error: 'messages required' }
  const model = body && typeof body.model === 'string' ? body.model : ''
  const base = nabugateBase()

  let produced = 0
  const track = (chunk) => {
    produced += chunk.length
    onDelta(chunk)
  }

  let result
  if (base) result = await streamNabuGate(base, messages, model, track, signal)
  else if (process.env.ANTHROPIC_API_KEY) result = await streamAnthropic(messages, track, signal)
  else return { status: 503, error: 'no-api' }

  if (result.status === 200 || result.aborted) return result
  // Only fall back when nothing was streamed — never duplicate partial output.
  if (result.canFallback && produced === 0) {
    const fb = await handleComplete(body)
    if (fb.status === 200) {
      if (fb.body.text) onDelta(fb.body.text)
      return { status: 200 }
    }
    return { status: fb.status, error: fb.body?.error }
  }
  return result
}

/**
 * @param {{messages: Array<{role: string, content: any}>}} body
 * @returns {Promise<{status: number, body: object}>}
 */
export async function handleComplete(body) {
  const messages = body && Array.isArray(body.messages) ? body.messages : null
  if (!messages || !messages.length) {
    return { status: 400, body: { error: 'messages required' } }
  }
  const model = body && typeof body.model === 'string' ? body.model : ''
  const base = nabugateBase()
  if (base) return callNabuGate(base, messages, model)
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic(messages)
  return { status: 503, body: { error: 'no-api' } }
}
