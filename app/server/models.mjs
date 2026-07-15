// Model catalog. Fetched from NabuGate's OpenAI-compatible `GET /v1/models`
// (the internal or external gateway), with a short in-memory cache and a static
// fallback so the picker still works before a gateway is wired up.

const CACHE_MS = 60 * 1000 // successful gateway result
const FALLBACK_CACHE_MS = 5 * 1000 // negative cache, so recovery is picked up quickly
let cache = { at: 0, models: null, ok: false }

const FALLBACK = [
  { id: 'nabu-fast', label: 'سریع (پیش‌فرض)' },
  { id: 'nabu-smart', label: 'هوشمند' },
]

function nabugateBase() {
  const url = (process.env.NABUGATE_URL || '').trim().replace(/\/+$/, '')
  if (url) return url
  const host = (process.env.NABUGATE_HOST || '').trim()
  if (!host) return ''
  const port = (process.env.NABUGATE_PORT || '8080').trim()
  const scheme = host.startsWith('http') ? '' : 'http://'
  return `${scheme}${host}:${port}`.replace(/\/+$/, '')
}

function humanize(id) {
  return String(id)
    .replace(/^nabu[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// NabuGate exposes a multi-model provider's catalog as "<provider>/<model>"
// (e.g. "parspack/openai/gpt-5.5"). Split on the first "/" so the provider
// becomes a group and the (possibly still-nested) rest becomes the label.
function describe(id) {
  const s = String(id)
  const slash = s.indexOf('/')
  if (slash > 0) {
    return { group: s.slice(0, slash), label: s.slice(slash + 1) }
  }
  return { group: '', label: humanize(s) }
}

async function fetchFromGateway(base) {
  const headers = {}
  if (process.env.NABUGATE_API_KEY) headers.authorization = `Bearer ${process.env.NABUGATE_API_KEY}`
  const res = await fetch(`${base}/v1/models`, { headers })
  if (!res.ok) throw new Error('models-' + res.status)
  const data = await res.json()
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
  const models = list
    .map((m) => (typeof m === 'string' ? { id: m } : m))
    .filter((m) => m && m.id)
    .map((m) => {
      const d = describe(m.id)
      const label = m.label || m.name || d.label
      // Group only namespaced provider models (parspack/…); flat curated
      // aliases (nabu-fast, …) stay ungrouped at the top of the list.
      return d.group ? { id: m.id, label, group: d.group } : { id: m.id, label }
    })
  return models.length ? models : FALLBACK
}

export async function listModels({ force = false } = {}) {
  const now = Date.now()
  const ttl = cache.ok ? CACHE_MS : FALLBACK_CACHE_MS
  if (!force && cache.models && now - cache.at < ttl) return cache.models
  const base = nabugateBase()
  if (!base) {
    cache = { at: now, models: FALLBACK, ok: false }
    return FALLBACK
  }
  try {
    const models = await fetchFromGateway(base)
    cache = { at: now, models, ok: true }
    return models
  } catch (err) {
    console.warn('[models] gateway fetch failed, using fallback:', err.message)
    cache = { at: now, models: FALLBACK, ok: false }
    return FALLBACK
  }
}

export function defaultModel() {
  return process.env.NABUGATE_MODEL || FALLBACK[0].id
}
