/**
 * Share feature — read-only, non-guessable preview links.
 *
 * Sharing writes a SNAPSHOT into the `shared_items` table at share time (not a live
 * reference), so later edits to the vault never mutate what a recipient sees, and the
 * record only contains the display surface (title, category name/chip, and the field
 * values we chose to expose) — never the owner's full private row or documents.
 *
 * Security model:
 *   - Each share is keyed by a cryptographically random 128-bit token (non-guessable).
 *   - RLS on `shared_items`: owner can insert/delete. There is NO general public SELECT.
 *     Unauthenticated visitors fetch a snapshot only through the `get_shared_item(token)`
 *     security-definer RPC, which is keyed by the exact token and never exposes owner_id.
 *   - The owner's `items`/`categories`/`documents` tables remain locked to the owner.
 */

import { supabase, supabaseConfigured } from './supabase'
import type { Category, ChecklistItem, Note, VaultItem } from '../types/app'

export type SharedFieldValue =
  | { kind: 'currency'; value: string }
  | { kind: 'url'; value: string }
  | { kind: 'text'; value: string }

/** Shared snapshot of a vault ITEM (category-fields display surface only). */
export type SharedItem = {
  id: string
  token: string
  kind: 'item'
  title: string
  category_name: string
  category_icon: string
  category_color: string
  image_url: string | null
  source_url: string | null
  notes: string | null
  fields: { label: string; value: SharedFieldValue; required?: boolean }[]
  created_at: string
}

/** Shared snapshot of a NOTE (title, body, checklist — nothing else). */
export type SharedNote = {
  id: string
  token: string
  kind: 'note'
  title: string
  notes: string | null
  checklist: ChecklistItem[]
  created_at: string
}

/** Anything a shared /s/:token snapshot can be. */
export type SharedSnapshot = SharedItem | SharedNote

/** Build the shareable snapshot from a live item + its category (mirrors the overlay's display logic). */
function buildSnapshot(
  item: VaultItem,
  category: Category | undefined,
): Omit<SharedItem, 'id' | 'token' | 'created_at'> {
  const fields: SharedItem['fields'] = []
  for (const field of category?.field_schema ?? []) {
    if (field.key === 'title' || field.key === 'notes') continue
    const raw = item.metadata?.[field.key]
    if (raw == null || raw === '') continue
    const text = String(raw)
    if (field.type === 'currency') {
      fields.push({ label: field.label, value: { kind: 'currency', value: text }, required: field.required })
    } else if (field.type === 'url') {
      fields.push({ label: field.label, value: { kind: 'url', value: text }, required: field.required })
    } else {
      fields.push({ label: field.label, value: { kind: 'text', value: text }, required: field.required })
    }
  }
  return {
    kind: 'item',
    title: item.title,
    category_name: category?.name ?? 'Vault',
    category_icon: category?.icon ?? '✨',
    category_color: category?.color ?? '#dc5000',
    image_url: item.image_url,
    source_url: item.source_url,
    notes: item.notes,
    fields,
  }
}

let tokenCache: Record<string, string> | null = null

/** Generate a cryptographically random, non-guessable token (128 bits of entropy, URL-safe). */
export function generateShareToken(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Absolute URL for a shared snapshot. */
export function buildShareUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/s/${token}`
}

/**
 * Insert a snapshot row for the signed-in user and return its token (and URL).
 * Shared by item and note sharing so there is one code path for token generation,
 * owner_id resolution, insert, and error handling. Fails loudly if Supabase isn't
 * configured or the authenticated user is missing.
 */
async function insertSnapshot(
  snapshot: Omit<SharedItem, 'id' | 'token' | 'created_at'> | Omit<SharedNote, 'id' | 'token' | 'created_at'>,
): Promise<{ token: string; url: string }> {
  if (!supabaseConfigured) {
    throw new Error('Sharing isn’t available because the app isn’t connected to a database yet.')
  }
  // owner_id is NOT NULL (no server default) and the RLS INSERT policy requires
  // auth.uid() = owner_id, so we must supply it from the session — otherwise the
  // insert fails with a null-not-null violation. Mirrors addItem / uploadDocument.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('You must be signed in to create a share link.')
  }

  const token = generateShareToken()
  const payload = {
    owner_id: user.id,
    token,
    kind: snapshot.kind,
    title: snapshot.title,
    notes: snapshot.notes,
    checklist: snapshot.kind === 'note' ? (snapshot as SharedNote).checklist : [],
    category_name: snapshot.kind === 'item' ? (snapshot as SharedItem).category_name : 'Note',
    category_icon: snapshot.kind === 'item' ? (snapshot as SharedItem).category_icon : '📝',
    category_color: snapshot.kind === 'item' ? (snapshot as SharedItem).category_color : '#dc5000',
    image_url: snapshot.kind === 'item' ? (snapshot as SharedItem).image_url : null,
    source_url: snapshot.kind === 'item' ? (snapshot as SharedItem).source_url : null,
    fields: snapshot.kind === 'item' ? (snapshot as SharedItem).fields : [],
  }

  const { data, error } = await supabase
    .from('shared_items')
    .insert(payload)
    .select('token')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Could not create share link.')
  }
  const url = buildShareUrl(data.token)
  tokenCache = tokenCache ?? {}
  tokenCache[data.token] = url
  return { token: data.token, url }
}

/**
 * Create a share snapshot for an ITEM and return its token (and URL).
 */
export async function createSharedItem(
  item: VaultItem,
  category: Category | undefined,
): Promise<{ token: string; url: string }> {
  return insertSnapshot(buildSnapshot(item, category))
}

/**
 * Create a share snapshot for a NOTE and return its token (and URL).
 * Only the title, body (notes) and checklist are copied — never the owner's
 * private note id/user_id/timestamps.
 */
export async function createSharedNote(note: Note): Promise<{ token: string; url: string }> {
  return insertSnapshot({
    kind: 'note',
    title: note.title.trim() || 'Untitled note',
    notes: note.body,
    checklist: note.checklist,
  })
}

/** Fetch a shared snapshot by token.
 * Goes through the `get_shared_item(token)` security-definer RPC, which is keyed by
 * the exact token (returns at most one row) and never exposes `owner_id`. This works
 * for unauthenticated visitors while the shared_items table itself has no general
 * public SELECT policy. */
export async function fetchSharedItem(token: string): Promise<SharedSnapshot | null> {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase
    .rpc('get_shared_item', { p_token: token })
    .maybeSingle()

  if (error || !data) return null
  return data as SharedSnapshot
}
