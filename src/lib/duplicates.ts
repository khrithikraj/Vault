import type { Category, VaultItem } from '../types/app'
import { normalizeText } from './search'

export type DuplicateMatch = {
  item: VaultItem
  category: Category
  /** Labels of the non-title fields already filled in on the existing item. */
  matchedFields: string[]
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
  const normalizedTitle = normalizeText(input.values.title)
  if (!normalizedTitle) return []

  const category = categories.find((c) => c.id === input.categoryId)
  if (!category) return []

  const results: DuplicateMatch[] = []
  for (const item of items) {
    if (item.category_id !== input.categoryId) continue
    if (normalizeText(item.title) !== normalizedTitle) continue

    let conflicts = false
    const matched: string[] = []
    const labels = new Map((category.field_schema ?? []).map((f) => [f.key, f.label]))

    for (const [key, raw] of Object.entries(input.values)) {
      const typed = normalizeText(raw)
      if (key === 'title' || key === 'notes' || !typed) continue
      const existing = item.metadata?.[key]
      if (existing == null || normalizeText(existing) === '') continue
      if (normalizeText(existing) !== typed) {
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