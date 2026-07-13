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
