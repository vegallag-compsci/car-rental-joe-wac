import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Without this, Vite silently moves to 5174 when 5173 is busy — and 5174
    // isn't in the API's CORS allow-list, so every request fails with an
    // opaque CORS error that looks like "the API is down".
    // Failing to start is a much clearer signal. If it happens, close the
    // other dev server (or add the new port to CORS_ORIGINS in api/.env).
    strictPort: true,
  },
})
