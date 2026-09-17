import { describe, expect, it } from 'vitest'
import type { VaultItem } from '../../src/types/app'
import {
  BRANCHES_KEY,
  branchSearchText,
  getBranches,
  getBranchesWithLegacyAddress,
  sanitizeBranch,
  withBranches,
} from '../../src/lib/branches'

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

const validBranch = { id: 'a', name: 'Gachibowli', address: 'Main Road', mapUrl: 'http://maps' }
const addressOnlyBranch = { id: 'b', name: '', address: 'Banjara Hills Rd 12', mapUrl: '' }

describe('branches', () => {
  it('returns an empty array for absent or malformed branch metadata', () => {
    expect(getBranches(makeItem())).toEqual([])
    expect(getBranches(makeItem({ metadata: { __branches: 'nope' } }))).toEqual([])
    expect(getBranches(makeItem({ metadata: { __branches: [{ id: 42 }] } }))).toEqual([])
  })

  it('filters out structurally invalid branch entries', () => {
    const item = makeItem({
      metadata: {
        __branches: [
          validBranch,
          { id: 'b', name: 'Missing address' },
          { id: 'c', name: 'Broken', address: 'X', mapUrl: 7 },
        ],
      },
    })
    const branches = getBranches(item)
    expect(branches).toHaveLength(1)
    expect(branches[0].name).toBe('Gachibowli')
  })

  it('supports address-only branches without requiring a branch name', () => {
    const item = makeItem({
      metadata: {
        __branches: [addressOnlyBranch],
      },
    })
    const branches = getBranches(item)
    expect(branches).toHaveLength(1)
    expect(branches[0].name).toBe('')
    expect(branches[0].address).toBe('Banjara Hills Rd 12')
  })

  it('preserves the legacy single address as an editable branch view', () => {
    const item = makeItem({ metadata: { address: '  Main Road  ' } })
    const branches = getBranchesWithLegacyAddress(item)
    expect(branches).toHaveLength(1)
    expect(branches[0].name).toBe('Cafe')
    expect(branches[0].address).toBe('Main Road')
    expect(branches[0].mapUrl).toBe('')
  })

  it('prefers real branches over the legacy address', () => {
    const item = makeItem({
      metadata: { address: 'Old Road', __branches: [validBranch] },
    })
    const branches = getBranchesWithLegacyAddress(item)
    expect(branches).toHaveLength(1)
    expect(branches[0].name).toBe('Gachibowli')
  })

  it('returns no branches when __branches is explicitly empty (never resurrects legacy address)', () => {
    const item = makeItem({
      metadata: { address: 'Old Road', __branches: [] },
    })
    expect(getBranchesWithLegacyAddress(item)).toEqual([])
  })

  it('returns no branches for an explicitly present but invalid __branches value', () => {
    const item = makeItem({
      metadata: { address: 'Old Road', __branches: 'not-an-array' },
    })
    expect(getBranchesWithLegacyAddress(item)).toEqual([])
  })

  it('still falls back to the legacy address only when branch metadata was never set', () => {
    const item = makeItem({ metadata: { address: 'Old Road' } })
    const branches = getBranchesWithLegacyAddress(item)
    expect(branches).toHaveLength(1)
    expect(branches[0].address).toBe('Old Road')
  })

  it('writes branches under __branches without destroying other metadata', () => {
    const item = makeItem({ metadata: { address: 'Road', price: '₹1200' } })
    const next = withBranches(item, [validBranch, addressOnlyBranch])
    expect(next[BRANCHES_KEY]).toEqual([validBranch, addressOnlyBranch])
    expect(next.price).toBe('₹1200')
    expect(next.address).toBe('Road')
  })

  it('sanitizes branch input strictly (with or without name)', () => {
    const branch = sanitizeBranch({ id: '', name: '  A  ', address: '  B  ', mapUrl: '  http://x  ' })
    expect(branch.name).toBe('A')
    expect(branch.address).toBe('B')
    expect(branch.mapUrl).toBe('http://x')
    expect(branch.id.length).toBeGreaterThan(0)

    const branchNoName = sanitizeBranch({ id: '', address: '  Only Address  ' })
    expect(branchNoName.name).toBe('')
    expect(branchNoName.address).toBe('Only Address')
    expect(branchNoName.mapUrl).toBe('')
  })

  it('exposes branch name and address for search', () => {
    const item = makeItem({
      metadata: {
        __branches: [
          validBranch,
          { id: 'b', name: 'Kukatpally', address: 'Highway', mapUrl: '' },
          addressOnlyBranch,
        ],
      },
    })
    const text = branchSearchText(item)
    expect(text).toContain('Gachibowli')
    expect(text).toContain('Main Road')
    expect(text).toContain('Kukatpally')
    expect(text).toContain('Highway')
    expect(text).toContain('Banjara Hills Rd 12')
  })
})
