// Minimal service worker: only exists to handle the PWA share-target POST and enable
// installability. Deliberately does NOT cache/intercept normal app or Supabase requests,
// so it can't accidentally serve stale data — the app is not offline-first.
const SHARE_CACHE = 'share-target-v1'

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const title = payload.title || "Raj's Vault"
  const options = {
    body: payload.body || 'A daily checklist item is due.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { noteId: payload.noteId, checklistItemId: payload.checklistItemId },
  }
  event.waitUntil(
    self.registration.showNotification(title, options).catch((error) => {
      // If showNotification rejects without a fallback, Chrome substitutes a generic
      // "site updated in the background" tile and the reminder is effectively lost.
      // Retry with the minimal, always-serializable options before giving up.
      console.error('[sw] showNotification failed, retrying minimal options', error)
      return self.registration.showNotification(title, { body: options.body })
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const noteId = event.notification.data?.noteId
  const target = noteId ? `/?openNote=${encodeURIComponent(noteId)}` : '/'
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target)
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
 
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
 