const SHARE_CACHE = 'share-target-v1'

/** Reads back a photo stashed by the service worker's share-target handler (see public/sw.js),
 * then clears it from the cache so it's only ever consumed once. Returns null if nothing is
 * pending (e.g. a normal launch, or the Cache Storage API isn't supported).
 */
export async function consumeSharedPhoto(): Promise<File | null> {
  if (typeof caches === 'undefined') {
    return null
  }
  const cache = await caches.open(SHARE_CACHE)
  const res = await cache.match('/shared-file-0')
  if (!res) {
    return null
  }
  const blob = await res.blob()
  await cache.delete('/shared-file-0')
  await cache.delete('/shared-meta')
  return new File([blob], 'shared-photo.jpg', { type: blob.type || 'image/jpeg' })
}
