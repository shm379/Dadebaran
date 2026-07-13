import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, the frontend runs on 5173 and the API/auth backend runs separately
// (npm run dev starts both). Proxy /api to it so cookies stay same-origin.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
})
