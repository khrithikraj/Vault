import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredUrl = env.VITE_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  const siteUrl = configuredUrl
    ? `${/^https?:\/\//.test(configuredUrl) ? '' : 'https://'}${configuredUrl}`.replace(/\/$/, '')
    : null

  return {
    define: mode === 'test' || mode === 'test-unconfigured'
      ? {
          'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(mode === 'test' ? 'https://test.supabase.co' : ''),
          'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(mode === 'test' ? 'public-test-key' : ''),
        }
      : undefined,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'vault-site-metadata',
        transformIndexHtml(html) {
          if (!siteUrl) return html
          return {
            html: html.split('/apple-touch-icon.png').join(`${siteUrl}/apple-touch-icon.png`),
            tags: [
              { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' },
              { tag: 'meta', attrs: { property: 'og:url', content: `${siteUrl}/` }, injectTo: 'head' },
            ],
          }
        },
        closeBundle() {
          if (!siteUrl) return
          writeFileSync(
            resolve('dist/sitemap.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc></url>\n</urlset>\n`,
          )
          writeFileSync(resolve('dist/robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`)
        },
      },
    ],
    server: {
      // "old p/" is a leftover backup copy synced via OneDrive — its files get locked
      // intermittently, which crashes the watcher (EBUSY) if Vite tries to track them too.
      watch: {
        ignored: ['**/old p/**', '**/public/fonts/**'],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            motion: ['motion'],
            supabase: ['@supabase/supabase-js'],
            pdfjs: ['pdfjs-dist'],
          },
        },
      },
    },
  }
})
