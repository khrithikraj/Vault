// Minimal service worker: only exists to handle the PWA share-target POST and enable
// installability. Deliberately does NOT cache/intercept normal app or Supabase requests,
// so it can't accidentally serve stale data — the app is not offline-first.
const SHARE_CACHE = 'share-target-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method === 'POST' && url.pathname === '/share-target/') {
    event.respondWith(handleShareTarget(event.request))
  }
})

async function handleShareTarget(request) {
  const formData = await request.formData()
  const files = formData.getAll('images').filter((entry) => entry instanceof File)
  const cache = await caches.open(SHARE_CACHE)

  await cache.put(
    '/shared-meta',
    new Response(
      JSON.stringify({
        title: formData.get('title') || '',
        text: formData.get('text') || '',
        url: formData.get('url') || '',
      }),
    ),
  )

  if (files[0]) {
    await cache.put('/shared-file-0', new Response(files[0], { headers: { 'Content-Type': files[0].type } }))
  }

  return Response.redirect('/?shared=1', 303)
}
