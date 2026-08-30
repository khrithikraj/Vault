import type { Category, Note, VaultDocument, VaultItem } from '../types/app'

// ---------------------------------------------------------------------------
// Vault-wide text search.
//
// Pure, in-memory, client-side — no database queries, no network, no OCR/AI.
// The dataset is small, so every keystroke can cheaply re-filter the already
// loaded items/notes/documents. Text is normalized before matching so casing,
// leading/trailing whitespace and formatting don't cause false negatives.
// ---------------------------------------------------------------------------

export type ItemFieldHit = { label: string; value: string }

export type ItemSearchHit = {
  item: VaultItem
  category: Category | null
  /** The fields that actually matched the query (for display on the card). */
  fields: ItemFieldHit[]
}

export type NoteSearchHit = {
  note: Note
  fields: ItemFieldHit[]
}

export type VaultSearchResults = {
  items: ItemSearchHit[]
  notes: NoteSearchHit[]
  documents: VaultDocument[]
}

/** The current section determines scope automatically — no manual dropdown. */
export type SearchScope =
  | { kind: 'everything' }
  | { kind: 'category'; categoryId: string }
  | { kind: 'notes' }
  | { kind: 'documents' }
  | { kind: 'trash' }

/** Fields whose values are always visible on the card already; they stay searchable
 * but are never duplicated as a "match" line on a result card. */
const HIDDEN_DISPLAY_LABELS = ['Title', 'Category']

/** Safely coerces any stored value (string/number/boolean/nested object) to text
 * without ever throwing — item metadata is user-shaped so we defend defensively. */
function searchableValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

/** Canonical form for comparison: NFKC-normalized, lowercased, whitespace collapsed. */
export function normalizeText(value: unknown): string {
  return searchableValue(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function queryTokens(query: string): string[] {
  return normalizeText(query).split(' ').filter(Boolean)
}

/** All query tokens must appear somewhere in the combined field text (partial matches
 * and multi-word queries like "Electronic City" both work). */
function matches(fields: ItemFieldHit[], query: string): boolean {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return false
  const haystack = fields.map((field) => normalizeText(field.value)).join(' ')
  return tokens.every((token) => haystack.includes(token))
}

/** Which fields visibly matched, limited to a couple so result cards stay compact. */
function matchedFields(fields: ItemFieldHit[], query: string): ItemFieldHit[] {
  const tokens = queryTokens(query)
  return fields
    .filter(
      (field) =>
        !HIDDEN_DISPLAY_LABELS.includes(field.label) &&
        tokens.some((token) => normalizeText(field.value).includes(token)),
    )
    .slice(0, 2)
}

function itemFields(item: VaultItem, category: Category | null): ItemFieldHit[] {
  const fields: ItemFieldHit[] = [
    { label: 'Title', value: item.title },
    { label: 'Category', value: category?.name ?? '' },
  ]
  if (item.tags && item.tags.length > 0) {
    for (const tag of item.tags) fields.push({ label: 'Tag', value: tag })
  }
  if (item.metadata) {
    const labels = new Map((category?.field_schema ?? []).map((field) => [field.key, field.label]))
    for (const [key, value] of Object.entries(item.metadata)) {
      const text = searchableValue(value)
      if (text) fields.push({ label: labels.get(key) ?? key, value: text })
    }
  }
  if (item.notes) fields.push({ label: 'Notes', value: item.notes })
  return fields
}

function noteFields(note: Note): ItemFieldHit[] {
  const fields: ItemFieldHit[] = [{ label: 'Title', value: note.title }]
  if (note.body) fields.push({ label: 'Content', value: note.body })
  if (note.checklist) {
    for (const entry of note.checklist) {
      if (entry.text) fields.push({ label: 'Checklist', value: entry.text })
    }
  }
  return fields
}

function documentFields(doc: VaultDocument): ItemFieldHit[] {
  return [
    { label: 'Name', value: doc.name },
    { label: 'Category', value: doc.category },
    { label: 'Type', value: doc.mime_type },
  ]
}

export function searchItems(
  items: VaultItem[],
  categories: Category[],
  query: string,
): ItemSearchHit[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const results: ItemSearchHit[] = []
  for (const item of items) {
    const category = categoriesById.get(item.category_id) ?? null
    const fields = itemFields(item, category)
    if (matches(fields, query)) {
      results.push({ item, category, fields: matchedFields(fields, query) })
    }
  }
  return results
}

export function searchNotes(notes: Note[], query: string): NoteSearchHit[] {
  const results: NoteSearchHit[] = []
  for (const note of notes) {
    const fields = noteFields(note)
    if (matches(fields, query)) {
      results.push({ note, fields: matchedFields(fields, query) })
    }
  }
  return results
}

export function searchDocuments(documents: VaultDocument[], query: string): VaultDocument[] {
  return documents.filter((doc) => matches(documentFields(doc), query))
}

export function searchVault(params: {
  query: string
  scope: SearchScope
  items: VaultItem[]
  categories: Category[]
  notes: Note[]
  documents: VaultDocument[]
  /** Trashed Item hits feed the Recently Deleted search results. */
  trashedItems?: VaultItem[]
  trashedNotes?: Note[]
  trashedDocuments?: VaultDocument[]
}): VaultSearchResults {
  const empty: VaultSearchResults = { items: [], notes: [], documents: [] }
  if (!normalizeText(params.query)) return empty

  const { query, scope } = params

  if (scope.kind === 'notes') {
    return { items: [], notes: searchNotes(params.notes, query), documents: [] }
  }

  if (scope.kind === 'documents') {
    return { items: [], notes: [], documents: searchDocuments(params.documents, query) }
  }

  if (scope.kind === 'trash') {
    return {
      items: searchItems(params.trashedItems ?? [], params.categories, query),
      notes: searchNotes(params.trashedNotes ?? [], query),
      documents: searchDocuments(params.trashedDocuments ?? [], query),
    }
  }

  const itemSource =
    scope.kind === 'category'
      ? params.items.filter((item) => item.category_id === scope.categoryId)
      : params.items

  const items = searchItems(itemSource, params.categories, query)
  const notes = scope.kind === 'everything' ? searchNotes(params.notes, query) : []
  const documents =
    scope.kind === 'everything' ? searchDocuments(params.documents, query) : []

  return { items, notes, documents }
}