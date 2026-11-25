import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const port = Number(env.VITE_PORT || 5173)
  const apiTarget = env.VITE_API_BASE || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
