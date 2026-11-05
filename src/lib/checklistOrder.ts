import type { ChecklistItem } from '../types/app'

function orderOf(item: ChecklistItem, fallback: number): number {
  return Number.isFinite(item.original_order) ? (item.original_order as number) : fallback
}

/** Adds stable original-order metadata without changing the caller's items. */
export function normalizeChecklistOrder(items: ChecklistItem[]): ChecklistItem[] {
  const completed = items.filter((item) => item.done)
  const completedFallbackOrder = new Map(
    [...completed]
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftCompleted = left.item.completed_at
        const rightCompleted = right.item.completed_at
        if (leftCompleted && rightCompleted && leftCompleted !== rightCompleted) {
          return leftCompleted.localeCompare(rightCompleted)
        }
        if (leftCompleted && !rightCompleted) return -1
        if (!leftCompleted && rightCompleted) return 1
        return orderOf(left.item, left.index) - orderOf(right.item, right.index)
      })
      .map(({ item }, index) => [item.id, index]),
  )
  return items.map((item, index) => ({
    ...item,
    original_order: orderOf(item, index),
    completed_at: item.completed_at ?? null,
    ...(item.done
      ? { completed_order: item.completed_order ?? completedFallbackOrder.get(item.id) ?? index }
      : {}),
  }))
}

/** Derives the visible order while preserving the persisted base order. */
export function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return normalizeChecklistOrder(items)
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (left.item.done !== right.item.done) return left.item.done ? -1 : 1
      if (left.item.done && right.item.done) {
        const completedDifference =
          (left.item.completed_order ?? left.index) -
          (right.item.completed_order ?? right.index)
        if (completedDifference) return completedDifference
      }
      const orderDifference = (left.item.original_order ?? left.index) - (right.item.original_order ?? right.index)
      return orderDifference || left.item.id.localeCompare(right.item.id)
    })
    .map(({ item }) => item)
}

export type ChecklistGroup = 'completed' | 'incomplete'

/** Persists an explicit drag order within one completion group only. */
export function reorderChecklistGroup(
  currentItems: ChecklistItem[],
  reorderedGroup: ChecklistItem[],
  group: ChecklistGroup,
): ChecklistItem[] {
  const normalized = normalizeChecklistOrder(currentItems)
  const orderById = new Map(reorderedGroup.map((item, index) => [item.id, index]))
  return normalized.map((item) => {
    const isInGroup = group === 'completed' ? item.done : !item.done
    if (!isInGroup) return item
    const order = orderById.get(item.id)
    if (order === undefined) return item
    return group === 'completed'
      ? { ...item, completed_order: order }
      : { ...item, original_order: order }
  })
}
