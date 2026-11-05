import { describe, expect, it } from 'vitest'
import type { ChecklistItem } from '../../src/types/app'
import { normalizeChecklistOrder, reorderChecklistGroup, sortChecklistItems } from '../../src/lib/checklistOrder'

function item(id: string, done = false, original_order?: number, completed_at?: string | null): ChecklistItem {
  return { id, text: id, done, original_order, completed_at }
}

describe('checklist ordering', () => {
  it('moves completed items first and keeps the oldest completion first', () => {
    const items = [
      item('a'),
      item('b', true, undefined, '2026-11-04T10:00:00.000Z'),
      item('c'),
      item('d', true, undefined, '2026-11-04T11:00:00.000Z'),
    ]
    expect(sortChecklistItems(items).map((entry) => entry.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('places a newly completed item after the existing completed sequence', () => {
    const items = [
      { ...item('old', true, 0), completed_order: 0 },
      item('new', false, 1),
    ]
    const completed = items.map((entry) =>
      entry.id === 'new'
        ? { ...entry, done: true, completed_at: '2026-11-04T11:00:00.000Z', completed_order: 1 }
        : entry,
    )
    expect(sortChecklistItems(completed).map((entry) => entry.id)).toEqual(['old', 'new'])
  })

  it('restores unchecked items to their original incomplete position', () => {
    const items = [
      item('a', false, 0),
      item('b', false, 1),
      item('c', false, 2),
    ]
    const completed = items.map((entry) =>
      entry.id === 'b' ? { ...entry, done: true, completed_at: '2026-11-04T10:00:00.000Z' } : entry,
    )
    const unchecked = completed.map((entry) =>
      entry.id === 'b' ? { ...entry, done: false, completed_at: null } : entry,
    )
    expect(sortChecklistItems(completed).map((entry) => entry.id)).toEqual(['b', 'a', 'c'])
    expect(sortChecklistItems(unchecked).map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('uses deterministic tie-breaking and does not mutate the source array', () => {
    const items = [
      item('b', true, 1, '2026-11-04T10:00:00.000Z'),
      item('a', true, 0, '2026-11-04T10:00:00.000Z'),
      item('c'),
    ]
    const sorted = sortChecklistItems(items)
    expect(sorted.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
    expect(items.map((entry) => entry.id)).toEqual(['b', 'a', 'c'])
  })

  it('preserves legacy completed order without timestamps or completed order metadata', () => {
    const items = [
      item('legacy-current-first', true, 1),
      item('legacy-original-first', true, 0),
      item('legacy-original-last', true, 2),
    ]
    expect(sortChecklistItems(items).map((entry) => entry.id)).toEqual([
      'legacy-original-first',
      'legacy-current-first',
      'legacy-original-last',
    ])
  })

  it('normalizes legacy items and reorders only the selected group', () => {
    const legacy = [item('a'), item('b')]
    expect(normalizeChecklistOrder(legacy).map((entry) => entry.original_order)).toEqual([0, 1])
    const mixed = [
      item('done-a', true, 0, '2026-11-04T10:00:00.000Z'),
      item('open-a', false, 1),
      item('done-b', true, 2, '2026-11-04T11:00:00.000Z'),
      item('open-b', false, 3),
    ]
    const reorderedCompleted = reorderChecklistGroup(mixed, [mixed[0], mixed[2]], 'completed')
    expect(reorderedCompleted.map((entry) => [entry.id, entry.original_order, entry.completed_order])).toEqual([
      ['done-a', 0, 0],
      ['open-a', 1, undefined],
      ['done-b', 2, 1],
      ['open-b', 3, undefined],
    ])
    const reorderedIncomplete = reorderChecklistGroup(reorderedCompleted, [mixed[3], mixed[1]], 'incomplete')
    expect(reorderedIncomplete.map((entry) => [entry.id, entry.original_order, entry.completed_order])).toEqual([
      ['done-a', 0, 0],
      ['open-a', 1, undefined],
      ['done-b', 2, 1],
      ['open-b', 0, undefined],
    ])
  })

  it('preserves manual completed order when a new item is completed', () => {
    const items = [
      { ...item('done-a', true, 0), completed_order: 1 },
      { ...item('done-b', true, 1), completed_order: 0 },
      item('open', false, 2),
    ]
    const reordered = reorderChecklistGroup(items, [items[1], items[0]], 'completed')
    const completed = reordered.map((entry) =>
      entry.id === 'open'
        ? { ...entry, done: true, completed_at: '2026-11-04T12:00:00.000Z', completed_order: 2 }
        : entry,
    )
    expect(sortChecklistItems(completed).map((entry) => entry.id)).toEqual(['done-b', 'done-a', 'open'])
    expect(completed.find((entry) => entry.id === 'open')?.original_order).toBe(2)
  })
})
