import { describe, expect, it } from 'vitest'
import type { VaultItem } from '../../src/types/app'
import { isFavorite, toggleFavorite, withFavoriteColumn, isItemFavorite, isNoteFavorite, isDocumentFavorite } from '../../src/lib/favorites'
import { isFavorite as ratingsIsFavorite, withFavoriteToggled } from '../../src/lib/ratings'
import type { Note, VaultDocument } from '../../src/types/app'

function makeItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'i1',
    user_id: 'u1',
    category_id: 'c1',
    title: 'Cafe',
    notes: null,
    image_url: null,
    source_url: null,
    tags: [],
    status: 'saved',
    metadata: {},
    is_favorite: false,
    created_at: '2026-09-13T00:00:00.000Z',
    updated_at: '2026-09-13T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('favorites', () => {
  it('prefers the database column', () => {
    expect(isFavorite({ is_favorite: true })).toBe(true)
    expect(isFavorite({ is_favorite: false })).toBe(false)
    expect(isFavorite({ is_favorite: true, metadata: { __favorite: false } })).toBe(true)
  })

  it('falls back to legacy metadata during migration', () => {
    expect(isFavorite({ metadata: { __favorite: true } })).toBe(true)
    expect(isFavorite({ metadata: { __favorite: false } })).toBe(false)
    expect(isFavorite({ metadata: {} })).toBe(false)
    expect(isFavorite({})).toBe(false)
    expect(isFavorite({ is_favorite: false, metadata: { __favorite: true } })).toBe(true)
  })

  it('toggles the column value', () => {
    expect(toggleFavorite({ is_favorite: false })).toEqual({ is_favorite: true })
    expect(toggleFavorite({ is_favorite: true })).toEqual({ is_favorite: false })
    expect(toggleFavorite(makeItem({ metadata: { __favorite: false } }))).toEqual({ is_favorite: true })
    expect(toggleFavorite(makeItem({ metadata: { __favorite: true } }))).toEqual({ is_favorite: false })
  })

  it('withFavoriteColumn preserves the rest of the record', () => {
    expect(withFavoriteColumn({ id: 'x', is_favorite: false }, true)).toEqual({
      id: 'x',
      is_favorite: true,
    })
  })

  it('entity-specific helpers share the same read path', () => {
    const item = makeItem({ is_favorite: true })
    const note = { id: 'n', is_favorite: true } as Note
    const doc = { id: 'd', is_favorite: false } as VaultDocument
    expect(isItemFavorite(item)).toBe(true)
    expect(isNoteFavorite(note)).toBe(true)
    expect(isDocumentFavorite(doc)).toBe(false)
    expect(ratingsIsFavorite(item)).toBe(true)
  })

  it('withFavoriteToggled keeps unrelated metadata intact', () => {
    const item = makeItem({
      metadata: { price: '₹200', __favorite: false, __triedEntries: [] },
    })
    const toggled = withFavoriteToggled(item)
    expect(toggled.price).toBe('₹200')
    expect(toggled.__triedEntries).toEqual([])
    expect(toggled.__favorite).toBe(true)
  })
})