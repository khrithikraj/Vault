import type { FoodSpotBranch, VaultItem } from '../types/app'

export const BRANCHES_KEY = '__branches'

function isBranch(value: unknown): value is FoodSpotBranch {
  if (!value || typeof value !== 'object') return false
  const branch = value as Record<string, unknown>
  return typeof branch.id === 'string' && typeof branch.name === 'string' &&
    typeof branch.address === 'string' && typeof branch.mapUrl === 'string'
}

export function getBranches(item: VaultItem): FoodSpotBranch[] {
  const raw = item.metadata?.[BRANCHES_KEY]
  return Array.isArray(raw) ? raw.filter(isBranch).map((branch) => ({ ...branch })) : []
}

/** Legacy address remains untouched; this only supplies an initial editable branch view.
 *
 * Explicit branch metadata wins over the legacy fallback:
 *   - __branches absent            -> legacy `address` MAY be synthesized
 *   - __branches has valid entries -> those branches are returned
 *   - __branches present but empty -> [] (an explicit "no branches" value must NOT
 *     resurrect the legacy address — the user deliberately removed the last branch)
 */
export function getBranchesWithLegacyAddress(item: VaultItem): FoodSpotBranch[] {
  const branches = getBranches(item)
  if (branches.length > 0) return branches
  // Only fall back to the legacy address when branch metadata was never set at all.
  if (item.metadata && BRANCHES_KEY in item.metadata) return []
  const address = typeof item.metadata?.address === 'string' ? item.metadata.address.trim() : ''
  return address
    ? [{ id: crypto.randomUUID(), name: item.title, address, mapUrl: '' }]
    : []
}

export function withBranches(item: VaultItem, branches: FoodSpotBranch[]): Record<string, unknown> {
  return { ...item.metadata, [BRANCHES_KEY]: branches.map((branch) => ({
    id: branch.id,
    name: branch.name.trim(),
    address: branch.address.trim(),
    mapUrl: branch.mapUrl.trim(),
  })) }
}

export function sanitizeBranch(input: Partial<FoodSpotBranch>): FoodSpotBranch {
  return {
    id: typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID(),
    name: String(input.name ?? '').trim(),
    address: String(input.address ?? '').trim(),
    mapUrl: String(input.mapUrl ?? '').trim(),
  }
}

export function branchSearchText(item: VaultItem): string {
  return getBranches(item).flatMap((branch) => [branch.name, branch.address]).join(' ')
}