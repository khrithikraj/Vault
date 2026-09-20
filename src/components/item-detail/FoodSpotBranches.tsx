import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { FoodSpotBranch, VaultItem } from '../../types/app'
import { getBranchesWithLegacyAddress, sanitizeBranch, withBranches } from '../../lib/branches'
import { MoreActionsMenu } from '../ui/MoreActionsMenu'
import { VaultButton } from '../ui/VaultButton'
import { VaultInput } from '../ui/VaultInput'

type FoodSpotBranchesProps = {
  item: VaultItem
  onUpdate: (metadata: Record<string, unknown>) => Promise<void> | void
}

export function FoodSpotBranches({ item, onUpdate }: FoodSpotBranchesProps) {
  const [branches, setBranches] = useState<FoodSpotBranch[]>(() => getBranchesWithLegacyAddress(item))
  const [draft, setDraft] = useState<FoodSpotBranch | null>(null)

  const beginAdd = () => setDraft(sanitizeBranch({ name: '', address: '', mapUrl: '' }))
  const beginEdit = (branch: FoodSpotBranch) => setDraft({ ...branch })
  const save = () => {
    if (!draft?.address.trim()) return
    const next = branches.some((branch) => branch.id === draft.id)
      ? branches.map((branch) => (branch.id === draft.id ? sanitizeBranch(draft) : branch))
      : [...branches, sanitizeBranch(draft)]
    setBranches(next)
    setDraft(null)
    void onUpdate(withBranches(item, next))
  }
  const remove = (branchId: string) => {
    const next = branches.filter((branch) => branch.id !== branchId)
    setBranches(next)
    void onUpdate(withBranches(item, next))
  }

  return (
    <section aria-labelledby="food-spot-branches-heading" className="mt-4 border border-dashed border-ink/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="food-spot-branches-heading" className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
          Branches
        </h3>
        <VaultButton type="button" variant="chip" size="sm" icon={Plus} onClick={beginAdd}>
          Add branch
        </VaultButton>
      </div>
      {branches.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {branches.map((branch) => {
            const branchLabel = branch.name.trim() || branch.address || 'branch'
            return (
              <li key={branch.id} className="border border-ink/10 bg-ink/5 p-2.5">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    {branch.name.trim() ? <p className="text-sm font-semibold text-ink">{branch.name}</p> : null}
                    <p className="text-xs text-ink-soft">{branch.address}</p>
                    {branch.mapUrl ? (
                      <a href={branch.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-xs text-accent underline">
                        Open map
                      </a>
                    ) : null}
                  </div>
                  <MoreActionsMenu
                    triggerLabel={`More actions for ${branchLabel}`}
                    items={[
                      { id: 'edit', label: 'Edit branch', icon: Pencil, onSelect: () => beginEdit(branch) },
                      {
                        id: 'delete',
                        label: 'Delete branch',
                        icon: Trash2,
                        danger: true,
                        divider: true,
                        onSelect: () => remove(branch.id),
                      },
                    ]}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm italic text-ink-soft/70">No branches added.</p>
      )}
      {draft ? (
        <div className="mt-3 grid gap-2 border-t border-ink/15 pt-3">
          <VaultInput
            aria-label="Branch name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Branch name (optional)"
          />
          <VaultInput
            aria-label="Branch address"
            value={draft.address}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
            placeholder="Address"
          />
          <VaultInput
            aria-label="Branch map URL"
            type="url"
            value={draft.mapUrl}
            onChange={(event) => setDraft({ ...draft, mapUrl: event.target.value })}
            placeholder="Map URL (optional)"
          />
          <div className="flex gap-2">
            <VaultButton type="button" variant="solid" size="sm" onClick={save} disabled={!draft.address.trim()}>
              Save branch
            </VaultButton>
            <VaultButton type="button" variant="chip" size="sm" icon={X} onClick={() => setDraft(null)}>
              Cancel
            </VaultButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}