import { averageRating, isFavorite } from '../../lib/ratings'
import type { Category, VaultItem } from '../../types/app'
import { VaultSelect } from '../VaultSelect'
import { StarRating } from '../ui/StarRating'
import { VaultInput } from '../ui/VaultInput'
import { FavoriteButton } from '../ui/FavoriteButton'
import { MoreActionsMenu, type MoreActionItem } from '../ui/MoreActionsMenu'

type ItemIdentitySectionProps = {
  item: VaultItem
  categories: Category[]
  category?: Category
  editing: boolean
  title: string
  categoryId: string
  /** Editorial metadata date (DD MMM) shown next to the category label. */
  metaDate: string
  onTitleChange: (title: string) => void
  onCategoryChange: (categoryId: string) => void
  onToggleFavorite: () => void
  moreItems: MoreActionItem[]
}

export function ItemIdentitySection({
  item,
  categories,
  category,
  editing,
  title,
  categoryId,
  metaDate,
  onTitleChange,
  onCategoryChange,
  onToggleFavorite,
  moreItems,
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
  const categoryLabel = category?.name ?? 'Item'

  return (
    <section aria-labelledby="item-identity-heading" className="border-b border-ink/15 pb-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
        {categoryLabel} · {metaDate}
      </p>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <h2
          id="item-identity-heading"
          className="min-w-0 flex-1 font-display text-xl font-semibold uppercase leading-tight text-ink sm:text-2xl"
        >
          {item.title}
        </h2>
        {rating != null ? (
          <span className="vault-chip inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold text-ink">
            <StarRating value={Math.round(rating)} size={11} /> {rating}
          </span>
        ) : null}
        <FavoriteButton
          active={isFavorite(item)}
          label={isFavorite(item) ? 'Remove from favorites' : 'Add to favorites'}
          onToggle={onToggleFavorite}
        />
        <MoreActionsMenu triggerLabel="More actions" items={moreItems} />
      </div>
    </section>
  )
}