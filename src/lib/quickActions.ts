import type { ChecklistItem } from '../types/app'

// ---------------------------------------------------------------------------
// Copy / Quick Actions — pure detection + link builders, no React.
// ---------------------------------------------------------------------------

export type FieldValueKind = 'text' | 'url' | 'email' | 'phone' | 'address'

export type QuickAction =
  | { kind: 'copy' }
  | { kind: 'open-url'; url: string }
  | { kind: 'mail' }
  | { kind: 'call'; tel: string }
  | { kind: 'maps'; query: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s().-]{7,20}$/
/** Keys/labels whose values are almost certainly a physical address, not random text. */
const ADDRESS_HINTS = /address|location|place|city|landmark|venue/i

/** Classifies a single stored value so the UI can offer the right actions. */
export function detectValueKind(
  value: string,
  fieldType?: string | null,
  keyOrLabel = '',
): FieldValueKind {
  const text = String(value ?? '').trim()
  if (!text) return 'text'
  if (fieldType === 'url' || /^https?:\/\//i.test(text)) return 'url'
  if (EMAIL_RE.test(text)) return 'email'
  if (PHONE_RE.test(text) && text.replace(/[^\d]/g, '').length >= 7) return 'phone'
  if (ADDRESS_HINTS.test(keyOrLabel)) return 'address'
  return 'text'
}

/** Copies are always available; url/email/phone/address add one contextual action. */
export function quickActionsFor(
  value: string,
  fieldType?: string | null,
  keyOrLabel = '',
): QuickAction[] {
  const kind = detectValueKind(value, fieldType, keyOrLabel)
  const actions: QuickAction[] = [{ kind: 'copy' }]
  switch (kind) {
    case 'url':
      actions.push({ kind: 'open-url', url: safeUrl(value) })
      break
    case 'email':
      actions.push({ kind: 'mail' })
      break
    case 'phone':
      actions.push({ kind: 'call', tel: value.replace(/[^\d+]/g, '') })
      break
    case 'address':
      actions.push({ kind: 'maps', query: value.trim() })
      break
    case 'text':
    default:
      break
  }
  return actions
}

/** Only http/https survive; anything else is forced to https (mirrors the item overlay). */
export function safeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

export function mailtoUrl(email: string): string {
  return `mailto:${email.trim()}`
}

export function callUrl(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`
}

export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`
}

/** Plain-text rendering of a note for clipboard copy: title, body, ☑/☐ checklist. */
export function formatNoteForClipboard(note: {
  title: string
  body: string
  checklist: ChecklistItem[]
}): string {
  const lines: string[] = []
  if (note.title.trim()) lines.push(note.title.trim())
  if (note.body.trim()) lines.push('', note.body.trim())
  if (note.checklist.length > 0) {
    lines.push('')
    for (const entry of note.checklist) {
      lines.push(`${entry.done ? '☑' : '☐'} ${entry.text}`)
    }
  }
  return lines.join('\n')
}