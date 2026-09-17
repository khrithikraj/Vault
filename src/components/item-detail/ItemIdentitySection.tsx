import { Loader2, Pencil, Share2 } from 'lucide-react'
import { CategoryIcon } from '../../lib/icons'
import { averageRating, isFavorite } from '../../lib/ratings'
import type { Category, VaultItem } from '../../types/app'
import { CopyButton } from '../CopyButton'
import { VaultSelect } from '../VaultSelect'
import { StarRating } from '../ui/StarRating'
import { VaultButton } from '../ui/VaultButton'
import { VaultInput } from '../ui/VaultInput'
import { FavoriteButton } from '../ui/FavoriteButton'

type ItemIdentitySectionProps = {
  item: VaultItem
  categories: Category[]
  category?: Category
  editing: boolean
  title: string
  categoryId: string
  shareState: 'idle' | 'sharing' | 'done' | 'error'
  onTitleChange: (title: string) => void
  onCategoryChange: (categoryId: string) => void
  onToggleFavorite: () => void
  onShare: () => void
  onEdit: () => void
}

export function ItemIdentitySection({
  item,
  categories,
  category,
  editing,
  title,
  categoryId,
  shareState,
  onTitleChange,
  onCategoryChange,
  onToggleFavorite,
  onShare,
  onEdit,
}: ItemIdentitySectionProps) {
  if (editing) {
    return (
      <section aria-labelledby="item-identity-heading" className="grid gap-3 border-b border-ink/15 pb-4">
        <h3 id="item-identity-heading" className="vault-meta text-ink-soft/55">Identity</h3>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Category
          <VaultSelect
            options={categories.map((entry) => ({ value: entry.id, label: `${entry.icon} ${entry.name}` }))}
            value={categoryId}
            onSelect={onCategoryChange}
            ariaLabel="Category"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Title
          <VaultInput
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Item title"
            required
            className="rounded-none text-base font-bold sm:text-lg"
          />
        </label>
      </section>
    )
  }

  const rating = item.status === 'done' ? averageRating(item) : null

  return (
    <section aria-labelledby="item-identity-heading" className="border-b border-ink/15 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {category ? (
            <p className="text-micro mb-1.5 flex items-center gap-1.5 text-ink-soft">
              <CategoryIcon icon={category.icon} color={category.color} size={14} />
              {category.name}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="item-identity-heading" className="font-display text-xl font-semibold uppercase leading-tight text-ink sm:text-2xl">
              {item.title}
            </h2>
            <CopyButton text={item.title} label="Copy" />
            {rating != null ? (
              <span className="vault-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-ink">
                <StarRating value={Math.round(rating)} size={11} /> {rating}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <FavoriteButton
            active={isFavorite(item)}
            label={isFavorite(item) ? 'Remove from favorites' : 'Add to favorites'}
            onToggle={onToggleFavorite}
          />
          <VaultButton
            type="button"
            variant="chip"
            size="sm"
            icon={shareState === 'sharing' ? Loader2 : Share2}
            disabled={shareState === 'sharing'}
            className={shareState === 'sharing' ? '[&>svg]:animate-spin' : undefined}
            onClick={onShare}
          >
            Share
          </VaultButton>
          <VaultButton type="button" variant="chip" size="sm" icon={Pencil} onClick={onEdit}>
            Edit
          </VaultButton>
        </div>
      </div>
    </section>
  )
}