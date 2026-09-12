/**
 * Favorites + "tried entries" ratings — both stored inside `VaultItem.metadata`
 * (no DB migration required) under reserved keys that never collide with
 * user-defined category field_schema keys because those are always plain,
 * non-prefixed identifiers.
 */
 
import type { VaultItem } from '../types/app'
 
export type TriedEntry = {
  id: string
  name: string
  rating: number
  note?: string
}
 
const FAVORITE_KEY = '__favorite'
const TRIED_KEY = '__triedEntries'
 
/** Internal keys that must never be exposed to the generic per-category field editor. */
export const INTERNAL_METADATA_KEYS = [FAVORITE_KEY, TRIED_KEY] as const
 
/** Pulls just the internal keys out of an item's metadata, to be re-merged after a generic edit. */
export function internalMetadata(item: VaultItem): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of INTERNAL_METADATA_KEYS) {
    if (item.metadata?.[key] !== undefined) out[key] = item.metadata[key]
  }
  return out
}
 
export function isFavorite(item: VaultItem): boolean {
  return item.metadata?.[FAVORITE_KEY] === true
}
 
/** Returns a full metadata patch (spreads existing metadata) with the favorite flag flipped. */
export function withFavoriteToggled(item: VaultItem): Record<string, unknown> {
  return { ...item.metadata, [FAVORITE_KEY]: !isFavorite(item) }
}
 
export function getTriedEntries(item: VaultItem): TriedEntry[] {
  const raw = item.metadata?.[TRIED_KEY]
  return Array.isArray(raw) ? (raw as TriedEntry[]) : []
}
 
/** Average of all tried-entry ratings, rounded to 1 decimal — null when there are none yet. */
export function averageRating(item: VaultItem): number | null {
  const entries = getTriedEntries(item)
  if (entries.length === 0) return null
  const sum = entries.reduce((total, entry) => total + entry.rating, 0)
  return Math.round((sum / entries.length) * 10) / 10
}
 
export function withTriedEntryAdded(
  item: VaultItem,
  input: { name: string; rating: number; note?: string },
): Record<string, unknown> {
  const entry: TriedEntry = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    note: input.note?.trim() || undefined,
  }
  return { ...item.metadata, [TRIED_KEY]: [...getTriedEntries(item), entry] }
}
 
export function withTriedEntryUpdated(
  item: VaultItem,
  entryId: string,
  patch: Partial<Pick<TriedEntry, 'name' | 'rating' | 'note'>>,
): Record<string, unknown> {
  return {
    ...item.metadata,
    [TRIED_KEY]: getTriedEntries(item).map((entry) =>
      entry.id === entryId ? { ...entry, ...patch } : entry,
    ),
  }
}
 
export function withTriedEntryRemoved(item: VaultItem, entryId: string): Record<string, unknown> {
  return {
    ...item.metadata,
    [TRIED_KEY]: getTriedEntries(item).filter((entry) => entry.id !== entryId),
  }
}
 
 