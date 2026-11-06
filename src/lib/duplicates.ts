import type { Category, VaultItem } from '../types/app'
import { normalizeText } from './search'
 
export type DuplicateMatch = {
  item: VaultItem
  category: Category
  /** Labels of the non-title fields already filled in on the existing item. */
  matchedFields: string[]
}

const YEAR_KEYS = new Set(['year', 'release_year', 'releaseYear'])
const SERIES_KEYS = new Set(['type', 'format', 'season', 'season_number', 'seasonNumber'])
const PRODUCT_KEYS = new Set(['brand', 'model', 'model_number', 'modelNumber', 'sku'])
const LOCATION_KEYS = new Set(['address', 'location', 'city', 'branch'])

function identityText(value: unknown): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function categoryKind(category: Category): 'movie' | 'food' | 'product' | 'place' | 'generic' {
  const name = normalizeText(category.name)
  if (name.includes('movie') || name.includes('series')) return 'movie'
  if (name.includes('food') || name.includes('restaurant')) return 'food'
  if (name.includes('buy') || name.includes('shopping') || name.includes('product')) return 'product'
  if (name.includes('place') || name.includes('temple') || name.includes('visit')) return 'place'
  return 'generic'
}

function relevantKeys(category: Category, values: Record<string, string>): Set<string> {
  const keys = new Set<string>()
  const kind = categoryKind(category)
  for (const key of Object.keys(values)) {
    if (key === 'title' || key === 'notes') continue
    if (kind === 'movie' && (YEAR_KEYS.has(key) || SERIES_KEYS.has(key))) keys.add(key)
    if (kind === 'food' && LOCATION_KEYS.has(key)) keys.add(key)
    if (kind === 'product' && PRODUCT_KEYS.has(key)) keys.add(key)
    if (kind === 'place' && LOCATION_KEYS.has(key)) keys.add(key)
    if (kind === 'generic') keys.add(key)
  }
  return keys
}

function normalizeItemTitle(category: Category, value: unknown): string {
  return categoryKind(category) === 'product' ? identityText(value) : normalizeText(value)
}
 
/**
 * Non-blocking duplicate detection for the capture flow.
 *
 * Rules (deliberately conservative — later edit-support on fields makes these safe to
 * relax):
 *  - Two items are candidates only if their normalized TITLE matches exactly AND they
 *    live in the same category.
 *  - For every non-title field the user is entering, if the existing item already has a
 *    value for that field and it DIFFERS from what the user typed, the items are treated
 *    as NOT duplicates (the user clearly means a different thing).
 *  - If the existing item's shared fields all agree (or don't exist yet), it's flagged as
 *    a possible duplicate with the matched field labels surfaced for the UI.
 */
export function findItemDuplicates(
  items: VaultItem[],
  categories: Category[],
  input: { categoryId: string; values: Record<string, string> },
): DuplicateMatch[] {
  const category = categories.find((c) => c.id === input.categoryId)
  if (!category) return []
  const title = normalizeItemTitle(category, input.values.title)
  if (!title) return []
  const identityKeys = relevantKeys(category, input.values)
 
  const results: DuplicateMatch[] = []
  for (const item of items) {
    if (item.category_id !== input.categoryId) continue
    if (normalizeItemTitle(category, item.title) !== title) continue
 
    let conflicts = false
    const matched: string[] = []
    const labels = new Map((category.field_schema ?? []).map((f) => [f.key, f.label]))
 
    for (const key of identityKeys) {
      const typed = categoryKind(category) === 'product'
        ? identityText(input.values[key])
        : normalizeText(input.values[key])
      if (!typed) continue
      const existing = item.metadata?.[key]
      const existingNormalized = categoryKind(category) === 'product'
        ? identityText(existing)
        : normalizeText(existing)
      if (existing == null || existingNormalized === '') continue
      if (existingNormalized !== typed) {
        conflicts = true
        break
      }
      matched.push(labels.get(key) ?? key)
    }
 
    if (conflicts) continue
    results.push({ item, category, matchedFields: matched })
  }
  return results
} 