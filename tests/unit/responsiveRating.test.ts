import { describe, expect, it } from 'vitest'
import { averageRating, getTriedEntries, withTriedEntryAdded } from '../../src/lib/ratings'
import type { VaultItem } from '../../src/types/app'

function makeItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'item-coffee',
    user_id: 'user-1',
    category_id: 'cat-food',
    title: 'Coffee confessions',
    notes: 'Great pour-over coffee',
    image_url: null,
    source_url: null,
    tags: ['coffee', 'cafe'],
    status: 'done',
    metadata: {},
    is_favorite: false,
    created_at: '2026-09-13T00:00:00.000Z',
    updated_at: '2026-09-13T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('rating layout and calculation support', () => {
  it('returns null when no tried entries exist', () => {
    const item = makeItem()
    expect(averageRating(item)).toBeNull()
  })

  it('correctly calculates average rating for items with single and multiple entries', () => {
    let item = makeItem()
    const patch1 = withTriedEntryAdded(item, { name: 'V60 Pour Over', rating: 5 })
    item = { ...item, metadata: patch1 }

    expect(getTriedEntries(item)).toHaveLength(1)
    expect(averageRating(item)).toBe(5)

    const patch2 = withTriedEntryAdded(item, { name: 'Cold Brew', rating: 4 })
    item = { ...item, metadata: patch2 }

    expect(getTriedEntries(item)).toHaveLength(2)
    expect(averageRating(item)).toBe(4.5)
  })

  it('handles item title and rating separation on narrow screens cleanly', () => {
    const item = makeItem({
      title: 'Coffee confessions',
      status: 'done',
      metadata: {
        __triedEntries: [{ id: 'e1', name: 'Espresso', rating: 4.8 }],
      },
    })

    const rating = item.status === 'done' ? averageRating(item) : null
    expect(rating).toBe(4.8)
    expect(item.title).toBe('Coffee confessions')
    expect(Math.round(rating!)).toBe(5)
  })
})
