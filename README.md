# Raj's — a personal visual vault

Your life, saved beautifully. Raj's is a PWA for stashing the things you want to buy, watch, try, and visit — screenshots, links, notes, and checklists — so you can find them again when it matters.

The Accession landing uses an editorial catalogue language, local image plates, self-hosted fonts, scroll-led anatomy, and reduced-motion fallbacks. The authenticated vault is lazy-loaded after the landing so it does not delay the first visit.

## Stack

- **React 18 + TypeScript + Vite** (`@vitejs/plugin-react`)
- **Tailwind CSS v4** (design tokens in `src/styles/tokens.css`)
- **Supabase** — Auth (email/password), Postgres (categories/items/notes), Storage (item photos)
- **`motion`** (framer-motion v12) for animation
- **Playwright** for Chrome/Edge local checks, visual baselines, and Chromium/Firefox/WebKit CI checks
- **PWA** — `public/manifest.webmanifest` + `public/sw.js` (installs as an app; the service worker only handles the OS share-target, it deliberately doesn't cache app data)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Create `.env.local` (copy from `.env.example`) with your Supabase values. Without them the app still boots — you'll see the landing and auth UI with a "not connected" message and a **preview vault** button.

## Environment variables

| Variable                    | Required | Description                                    |
| --------------------------- | -------- | ---------------------------------------------- |
| `VITE_SUPABASE_URL`         | yes      | Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY`    | yes      | Supabase anon (public) key                     |
| `VITE_SUPABASE_BUCKET`      | no       | Storage bucket name (defaults to `vault`)      |
| `VITE_SITE_URL`             | no       | Canonical production origin; inferred automatically on Vercel |

`.env.local` is gitignored — never commit secrets.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the schema in **SQL Editor**: copy `supabase/schema.sql`.
3. Create a Storage bucket named `vault` (or set `VITE_SUPABASE_BUCKET` to your own). Make its **public** read policy so item photos render.
4. Auth: email/password is all you need. Set your site URL (e.g. the deployed domain) under **Auth → URL Configuration** so email links (reset password, verify) route back correctly.

## Scripts

```bash
npm run dev      # dev server
npm run build    # type-check + production build → dist/
npm run preview  # serve the production build locally
npm run lint     # eslint
npm run test:e2e # Chrome + Edge behavior and Chrome visual regression
npm run test:e2e:ci # cross-engine behavior suite without OS-specific snapshots
npm run test:visual # Chrome visual regression only
```

## Deployment

It's a static Vite build — deploy `dist/` to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.). Three things to get right on every deploy:

1. **Set the env vars** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) on the host — not in the repo. Vite inlines them at build time. Missing them won't white-screen the app (it degrades to a "preview without a database" mode), but real auth needs real values.
2. **Serving path**: the app uses absolute paths (`/assets/...`, `/sw.js`, `/manifest.webmanifest`), so serve from the domain root or set `base` in `vite.config.ts` if deploying to a sub-path.
3. **SPA history fallback**: route all unmatched paths to `index.html` so deep links and the **password-reset email callback** resolve. Netlify → `public/_redirects` with `/* /index.html 200`. Vercel → Rewrites, Source `/(.*)` → Destination `/index.html`. Cloudflare → a `_redirects` file (same as Netlify).
4. **Canonical URL**: set `VITE_SITE_URL` on non-Vercel hosts. Vercel uses `VERCEL_PROJECT_PRODUCTION_URL`. Production builds then emit canonical/Open Graph URLs plus `sitemap.xml` and its robots declaration.

Host quick reference:

| Host | Build command | Output dir | History fallback |
| --- | --- | --- | --- |
| Netlify | `npm run build` | `dist` | `public/_redirects`: `/* /index.html 200` |
| Vercel | `npm run build` | `dist` | Rewrites → `/(.*)` → `/index.html` |
| Cloudflare Pages | `npm run build` | `dist` | `public/_redirects`: `/* /index.html 200` |

Also set the **deployed domain** under Supabase → **Auth → URL Configuration** so verification/reset emails route back correctly.

## Privacy and assets

- No analytics, session replay, or telemetry SDK is installed.
- Landing register text stays in browser `localStorage`; it is not sent to Supabase.
- User tables and storage paths use owner-scoped Supabase row-level security policies.
- Landing photos are local files, so page views do not contact an image CDN. Their source records are in `public/plates/README.md`.

## Continuous integration

`.github/workflows/quality.yml` runs lint, the production build, and behavior tests in Chromium, Firefox, and WebKit for every pull request and push to `main`. Chrome/Edge and visual snapshots remain available locally.

That's it — after the first deploy, install it from the browser's address bar (PWA) and share images to it from your phone's share sheet.
