import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error — plain .mjs helper, no types
import { handleComplete, readJson } from './server/anthropic.mjs'

// Serves POST /api/complete during `vite dev`, proxying to Anthropic.
function apiPlugin(): PluginOption {
  return {
    name: 'mrc-complete-api',
    configureServer(server) {
      server.middlewares.use('/api/complete', async (req, res, next) => {
        if (req.method !== 'POST') return next()
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
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
})
