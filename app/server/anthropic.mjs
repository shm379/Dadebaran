// Shared handler that proxies chat/vision requests to the Anthropic Messages
// API. Used by both the Vite dev middleware (see vite.config.ts) and the
// standalone production server (server.mjs).
//
// The client already sends messages in Anthropic's content-block shape
// ({type:'text',...} / {type:'image',source:{type:'base64',...}}), so we pass
// them straight through. Without ANTHROPIC_API_KEY we return 503 so the UI
// degrades to its friendly Persian preview message.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
const MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 1500)

/**
 * @param {{messages: Array<{role: string, content: any}>}} body
 * @returns {Promise<{status: number, body: object}>}
 */
export async function handleComplete(body) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { status: 503, body: { error: 'no-api' } }
  }
  const messages = body && Array.isArray(body.messages) ? body.messages : null
  if (!messages || !messages.length) {
    return { status: 400, body: { error: 'messages required' } }
  }

  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages }),
    })
  } catch (err) {
    return { status: 502, body: { error: 'upstream-unreachable: ' + String(err) } }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { status: 502, body: { error: 'anthropic-' + res.status, detail } }
  }

  const data = await res.json()
  const text = Array.isArray(data.content)
    ? data.content
        .filter((b) => b && b.type === 'text')
        .map((b) => b.text)
        .join('')
    : ''
  return { status: 200, body: { text } }
}

/** Read and JSON-parse a Node request body (bounded to ~12 MB for base64 media). */
export function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let tooBig = false
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 12 * 1024 * 1024) {
        tooBig = true
        req.destroy()
      }
    })
    req.on('end', () => {
      if (tooBig) return reject(new Error('payload too large'))
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
