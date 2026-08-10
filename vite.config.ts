import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // "old p/" is a leftover backup copy synced via OneDrive — its files get locked
    // intermittently, which crashes the watcher (EBUSY) if Vite tries to track them too.
    watch: {
      ignored: ['**/old p/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
