// Tiny in-memory fixed-window rate limiter for the auth endpoints. Good enough
// for a single instance; for multiple replicas back it with Redis instead.
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map() // key -> { count, reset }

  return function (req, res, next) {
    const now = Date.now()
    // Occasionally prune expired entries so the map can't grow unbounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    }
    const fwd = req.headers['x-forwarded-for']
    const key = (fwd ? String(fwd).split(',')[0].trim() : '') || req.ip || req.socket?.remoteAddress || 'unknown'
    let e = hits.get(key)
    if (!e || e.reset < now) {
      e = { count: 0, reset: now + windowMs }
      hits.set(key, e)
    }
    e.count++
    if (e.count > max) {
      res.setHeader('Retry-After', Math.ceil((e.reset - now) / 1000))
      return res.status(429).json({ error: 'rate_limited', message: message || 'درخواست‌های زیاد. کمی بعد دوباره امتحان کن.' })
    }
    next()
  }
}
