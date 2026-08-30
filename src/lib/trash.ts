// ---------------------------------------------------------------------------
// Trash / Recently Deleted helpers — pure display logic, no React.
// ---------------------------------------------------------------------------

export type TrashKind = 'item' | 'note' | 'document'

const prettyDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** Relative human label for when something was deleted ("today"/"yesterday"/date). */
export function deletedLabel(deletedAt: string): string {
  const deleted = new Date(deletedAt)
  if (Number.isNaN(deleted.getTime())) return 'Deleted'
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const deletedDay = new Date(deleted.getFullYear(), deleted.getMonth(), deleted.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - deletedDay) / 86_400_000)
  if (dayDiff <= 0) return 'Deleted today'
  if (dayDiff === 1) return 'Deleted yesterday'
  return `Deleted on ${prettyDate.format(deleted)}`
}

/** Trash is always shown most-recently-deleted first. */
export function sortTrashedByDeletedAt<T extends { deleted_at: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const at = new Date(a.deleted_at ?? 0).getTime()
    const bt = new Date(b.deleted_at ?? 0).getTime()
    return bt - at
  })
}