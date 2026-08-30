import type { Category, Note, VaultDocument, VaultItem } from '../types/app'
import type { TrashKind } from './trash'

export type TrashRow = {
  kind: TrashKind
  id: string
  name: string
  /** Secondary line, e.g. the category name for items or the doc category. */
  meta: string
  deletedAt: string
}

/** Merges soft-deleted items/notes/documents into a single sortable row list. */
export function buildTrashRows(params: {
  items: VaultItem[]
  notes: Note[]
  documents: VaultDocument[]
  categories: Category[]
}): TrashRow[] {
  const rows: TrashRow[] = []
  for (const item of params.items) {
    const category = params.categories.find((c) => c.id === item.category_id)
    rows.push({
      kind: 'item',
      id: item.id,
      name: item.title,
      meta: category?.name ?? 'Item',
      deletedAt: item.deleted_at ?? '',
    })
  }
  for (const note of params.notes) {
    rows.push({
      kind: 'note',
      id: note.id,
      name: note.title.trim() || 'Untitled note',
      meta: 'Note',
      deletedAt: note.deleted_at ?? '',
    })
  }
  for (const doc of params.documents) {
    rows.push({
      kind: 'document',
      id: doc.id,
      name: doc.name,
      meta: doc.category,
      deletedAt: doc.deleted_at ?? '',
    })
  }
  return rows.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
}