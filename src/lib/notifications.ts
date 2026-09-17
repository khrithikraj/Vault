import { supabase } from './supabase'

export type NotificationStatus =
  | { kind: 'unsupported'; message: string }
  | { kind: 'denied'; message: string }
  | { kind: 'disabled'; message: string }
  | { kind: 'enabled'; message: string }

export type NotificationSetupResult =
  | { kind: 'enabled' }
  | { kind: 'disabled' }
  | { kind: 'unsupported'; message: string }
  | { kind: 'denied'; message: string }
  | { kind: 'error'; message: string }

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { kind: 'unsupported', message: 'This browser does not support push notifications.' }
  }
  if (Notification.permission === 'denied') {
    return { kind: 'denied', message: 'Notifications are blocked by the browser.' }
  }
  if (Notification.permission === 'default') {
    return { kind: 'disabled', message: 'Notifications have not been requested yet.' }
  }
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      return { kind: 'disabled', message: 'Notifications are permitted but not subscribed on this device.' }
    }
    return { kind: 'enabled', message: 'Notifications are enabled on this device.' }
  } catch {
    return { kind: 'disabled', message: 'Could not check the subscription status.' }
  }
}

export function decodeVapidKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

/** A valid Web-Push applicationServerKey is an uncompressed P-256 point (65 bytes, 0x04 prefix). */
export function isValidApplicationServerKey(decoded: Uint8Array): boolean {
  return decoded.length === 65 && decoded[0] === 0x04
}

/** Maps DOMException names (Chrome's subscribe() errors are generic) to clear, actionable text. */
export function describePushError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'The browser refused to create the subscription. Check the site notification permission and that you are signed in to Chrome.'
      case 'InvalidStateError':
        return 'A conflicting subscription already exists on this device. Turn notifications off and on again.'
      case 'SecurityError':
        return 'Push notifications require a secure connection (HTTPS or localhost).'
      case 'NetworkError':
        return 'Could not reach your browser push service. Check your connection.'
      case 'AbortError':
        return 'Your browser aborted push setup. Try again (a VPN or firewall can cause this).'
      default:
        return `${error.name}: ${error.message}`
    }
  }
  return error instanceof Error ? error.message : 'Could not enable notifications.'
}

export async function enablePushNotifications(): Promise<NotificationSetupResult> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { kind: 'unsupported', message: 'This browser does not support push notifications.' }
  }
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return { kind: 'error', message: 'Push notifications are not configured for this deployment yet.' }
  }

  let applicationServerKey: Uint8Array
  try {
    applicationServerKey = decodeVapidKey(publicKey)
  } catch {
    return { kind: 'error', message: 'The push application key is not valid base64url. Check VITE_VAPID_PUBLIC_KEY.' }
  }
  if (!isValidApplicationServerKey(applicationServerKey)) {
    // Typically a stale dev bundle or a mismatched deployment env var.
    return { kind: 'error', message: 'The push application key is invalid. Restart the dev server after updating .env.local and check that the Vercel variable matches the send-reminders function key.' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { kind: 'denied', message: 'Notifications are blocked. Enable them in browser settings to receive reminders.' }
  }
  try {
    const registration = await navigator.serviceWorker.ready
    if (!registration.pushManager) {
      return { kind: 'error', message: 'This browser cannot manage push subscriptions.' }
    }

    // Reuse an existing subscription instead of re-subscribing: Chrome rejects a
    // second subscribe() on the same registration (InvalidStateError -> opaque
    // "Registration failed - push service error").
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { kind: 'error', message: 'The browser returned an incomplete push subscription.' }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { kind: 'error', message: 'You must be signed in to enable notifications.' }
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: 'user_id,endpoint' })
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'enabled' }
  } catch (error) {
    console.error('Push subscription failed:', error)
    return { kind: 'error', message: describePushError(error) }
  }
}

export async function disablePushNotifications(): Promise<{ ok: boolean; message?: string }> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return { ok: true, message: 'Notifications are already off.' }
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('endpoint', endpoint)
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: 'Notifications disabled on this device.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not disable notifications.' }
  }
}
