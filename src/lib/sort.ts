/**
 * Client-side sort helpers, shared by the Items, Documents and Notes toolbars.
 * All sorting happens on already-fetched arrays — no query changes needed.
 */
 
import type { Note, VaultDocument, VaultItem } from '../types/app'
 
export type ItemSortKey = 'name-asc' | 'name-desc' | 'newest' | 'oldest'
export type NoteSortKey = 'name-asc' | 'name-desc' | 'newest' | 'oldest'
export type DocumentSortKey = 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'size-asc' | 'size-desc'
 
export const ITEM_SORT_OPTIONS: { value: ItemSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
]
 
export const NOTE_SORT_OPTIONS: { value: NoteSortKey; label: string }[] = [
  { value: 'newest', label: 'Recently updated' },
  { value: 'oldest', label: 'Oldest updated' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
]
 
export const DOCUMENT_SORT_OPTIONS: { value: DocumentSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'size-asc', label: 'Size (smallest)' },
  { value: 'size-desc', label: 'Size (largest)' },
]
 
function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}
 
export function sortItems(items: VaultItem[], key: ItemSortKey): VaultItem[] {
  const copy = [...items]
  switch (key) {
    case 'name-asc':
      return copy.sort((a, b) => byName(a.title, b.title))
    case 'name-desc':
      return copy.sort((a, b) => byName(b.title, a.title))
    case 'oldest':
      return copy.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    case 'newest':
    default:
      return copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }
}
 
export function sortNotes(notes: Note[], key: NoteSortKey): Note[] {
  const copy = [...notes]
  switch (key) {
    case 'name-asc':
      return copy.sort((a, b) => byName(a.title, b.title))
    case 'name-desc':
      return copy.sort((a, b) => byName(b.title, a.title))
    case 'oldest':
      return copy.sort((a, b) => +new Date(a.updated_at) - +new Date(b.updated_at))
    case 'newest':
    default:
      return copy.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
  }
}
 
export function sortDocuments(documents: VaultDocument[], key: DocumentSortKey): VaultDocument[] {
  const copy = [...documents]
  switch (key) {
    case 'name-asc':
      return copy.sort((a, b) => byName(a.name, b.name))
    case 'name-desc':
      return copy.sort((a, b) => byName(b.name, a.name))
    case 'oldest':
      return copy.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    case 'size-asc':
      return copy.sort((a, b) => a.file_size - b.file_size)
    case 'size-desc':
      return copy.sort((a, b) => b.file_size - a.file_size)
    case 'newest':
    default:
      return copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }
}
 
 