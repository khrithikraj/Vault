import { describe, expect, it } from 'vitest'
import type { Category, VaultItem } from '../../src/types/app'
import { findItemDuplicates } from '../../src/lib/duplicates'

const category = (id: string, name: string, keys: string[]): Category => ({
  id,
  user_id: 'user',
  name,
  color: '#000',
  icon: '•',
  is_default: true,
  field_schema: keys.map((key) => ({ key, label: key, type: 'text', required: key === 'title' })),
  created_at: '',
})

const item = (
  id: string,
  categoryId: string,
  title: string,
  metadata: Record<string, unknown> = {},
  deleted_at: string | null = null,
): VaultItem => ({
  id,
  user_id: 'user',
  category_id: categoryId,
  title,
  notes: null,
  image_url: null,
  source_url: null,
  tags: [],
  status: 'saved',
  metadata,
  is_favorite: false,
  created_at: '',
  updated_at: '',
  deleted_at,
})

describe('findItemDuplicates', () => {
  it('matches movies by normalized title and same known year', () => {
    const movies = category('movies', 'Movies & Series', ['title', 'release_year'])
    expect(findItemDuplicates(
      [item('m1', 'movies', 'Arrival', { release_year: '2016' })],
      [movies],
      { categoryId: 'movies', values: { title: ' arrival ', release_year: '2016' } },
    )).toHaveLength(1)
  })

  it('matches movie capitalization and extra spaces', () => {
    const movies = category('movies', 'Movies & Series', ['title'])
    const existing = [item('m1', 'movies', 'The  Matrix')]
    expect(findItemDuplicates(existing, [movies], { categoryId: 'movies', values: { title: 'the matrix' } })).toHaveLength(1)
  })

  it('keeps movies with different known release years separate', () => {
    const movies = category('movies', 'Movies & Series', ['title', 'year'])
    const existing = [item('m1', 'movies', 'Dune', { year: '1984' })]
    expect(findItemDuplicates(existing, [movies], { categoryId: 'movies', values: { title: 'Dune', year: '2021' } })).toHaveLength(0)
  })

  it('matches a restaurant only when its address agrees', () => {
    const food = category('food', 'Food Spots', ['title', 'address'])
    const existing = [item('f1', 'food', 'Momo House', { address: '12 Main St' })]
    expect(findItemDuplicates(existing, [food], { categoryId: 'food', values: { title: 'Momo House', address: '12 Main St' } })).toHaveLength(1)
    expect(findItemDuplicates(existing, [food], { categoryId: 'food', values: { title: 'Momo House', address: '99 Lake Road' } })).toHaveLength(0)
  })

  it('matches products across harmless punctuation and formatting differences', () => {
    const products = category('buy', 'Things To Buy', ['title', 'brand', 'model', 'sku'])
    const existing = [item('p1', 'buy', 'Noise-Cancelling Headphones', { brand: 'Acme', model: 'X-100' })]
    expect(findItemDuplicates(existing, [products], {
      categoryId: 'buy',
      values: { title: 'noise cancelling headphones', brand: ' acme ', model: 'X 100' },
    })).toHaveLength(1)
  })

  it('does not merge different product models', () => {
    const products = category('buy', 'Things To Buy', ['title', 'model'])
    const existing = [item('p1', 'buy', 'Camera', { model: 'A-1' })]
    expect(findItemDuplicates(existing, [products], { categoryId: 'buy', values: { title: 'Camera', model: 'B-2' } })).toHaveLength(0)
  })

  it('isolates identical titles by category', () => {
    const movies = category('movies', 'Movies & Series', ['title'])
    const food = category('food', 'Food Spots', ['title'])
    expect(findItemDuplicates(
      [item('m1', 'movies', 'Heat')],
      [movies, food],
      { categoryId: 'food', values: { title: 'Heat' } },
    )).toHaveLength(0)
  })

  it('can inspect a trashed item when it is included by the caller', () => {
    const places = category('places', 'Places To Visit', ['title', 'location'])
    const existing = [item('p1', 'places', 'Museum', { location: 'Paris' }, '2026-11-01T00:00:00Z')]
    const matches = findItemDuplicates(existing, [places], { categoryId: 'places', values: { title: 'Museum', location: 'Paris' } })
    expect(matches[0]?.item.deleted_at).toBe('2026-11-01T00:00:00Z')
  })

  it('does not match similar but different titles', () => {
    const places = category('places', 'Places To Visit', ['title'])
    expect(findItemDuplicates([item('p1', 'places', 'Central Park')], [places], {
      categoryId: 'places',
      values: { title: 'Central Park Museum' },
    })).toHaveLength(0)
  })

  it('matches when optional identity metadata is missing', () => {
    const food = category('food', 'Food Spots', ['title', 'address'])
    expect(findItemDuplicates([item('f1', 'food', 'Cafe')], [food], {
      categoryId: 'food',
      values: { title: 'Cafe', address: 'Somewhere' },
    })).toHaveLength(1)
  })

  it('preserves conservative generic matching for custom categories', () => {
    const custom = category('custom', 'Ideas', ['title', 'topic'])
    expect(findItemDuplicates([item('i1', 'custom', 'Project', { topic: 'Home' })], [custom], {
      categoryId: 'custom',
      values: { title: 'Project', topic: 'Home' },
    })).toHaveLength(1)
    expect(findItemDuplicates([item('i1', 'custom', 'Project', { topic: 'Home' })], [custom], {
      categoryId: 'custom',
      values: { title: 'Project', topic: 'Work' },
    })).toHaveLength(0)
  })
})
