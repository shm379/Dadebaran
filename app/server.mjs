// Standalone production server: serves the built `dist/` and the same
// /api/complete proxy used in dev. Run with `npm run build && npm start`.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleComplete, readJson } from './server/anthropic.mjs'

const DIST = fileURLToPath(new URL('./dist', import.meta.url))
const PORT = Number(process.env.PORT || 5173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

async function serveStatic(res, urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(DIST, clean === '/' ? 'index.html' : clean)
  try {
    let data = await readFile(filePath).catch(() => null)
    if (!data) {
      filePath = join(DIST, 'index.html') // SPA fallback
      data = await readFile(filePath)
    }
    res.statusCode = 200
    res.setHeader('content-type', MIME[extname(filePath)] || 'application/octet-stream')
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end('Not found')
  }
}

createServer(async (req, res) => {
  if (req.url && req.url.startsWith('/api/complete')) {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end('Method not allowed')
      return
    }
    try {
      const body = await readJson(req)
      const { status, body: out } = await handleComplete(body)
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(out))
    } catch (err) {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: String(err) }))
    }
    return
  }
  await serveStatic(res, req.url || '/')
}).listen(PORT, () => {
  console.log(`MR.CHATGPT assistants running at http://localhost:${PORT}`)
})
