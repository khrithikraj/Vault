import type { Note, VaultDocument, VaultItem } from '../types/app'

type FavoriteRecord = { is_favorite?: boolean | null }

/** Reads the migrated column, while keeping old item rows visible during rollout. */
export function isFavorite(record: FavoriteRecord & Partial<Pick<VaultItem, 'metadata'>>): boolean {
  if (record.is_favorite === true) return true
  if (record.is_favorite === false && !record.metadata) return false
  return record.metadata?.__favorite === true
}

export function toggleFavorite<T extends FavoriteRecord>(record: T): Pick<T, 'is_favorite'> {
  return { is_favorite: !isFavorite(record as T & Partial<Pick<VaultItem, 'metadata'>>) }
}

export function withFavoriteColumn<T extends FavoriteRecord>(record: T, value: boolean): T & { is_favorite: boolean } {
  return { ...record, is_favorite: value }
}

export function isItemFavorite(item: VaultItem): boolean {
  return isFavorite(item)
}

export function isNoteFavorite(note: Note): boolean {
  return isFavorite(note)
}

export function isDocumentFavorite(document: VaultDocument): boolean {
  return isFavorite(document)
}