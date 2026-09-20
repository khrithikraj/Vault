import { Trash2 } from 'lucide-react'
import { CategoryIcon } from '../../lib/icons'
import { CompletionControl } from '../CompletionControl'
import { averageRating, isFavorite } from '../../lib/ratings'
import type { Category, VaultItem } from '../../types/app'
import type { ItemFieldHit } from '../../lib/search'
import { FavoriteButton } from '../ui/FavoriteButton'

type ArchiveObjectProps = {
  item: VaultItem
  category?: Category
  /** Larger lead object rendered first in the editorial arrangement. */
  large?: boolean
  onOpen: (item: VaultItem) => void
  onToggle: (item: VaultItem) => void
  onDelete: (item: VaultItem) => void
  onToggleFavorite?: (item: VaultItem) => void
  searchHits?: ItemFieldHit[]
  showCategory?: boolean
}

const prettyDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
})

/**
 * V2 — Archive Object.
 *
 * A premium editorial record card in the shared card family (`.vault-card`).
 * Top label strip with category marker + compact actions (favourite, delete),
 * title-first body with optional specimen thumbnail, footer with date and the
 * mark-done completion slot — all using the same container/action/footer
 * grammar as Notes, Documents and Trash.
 */
export function ArchiveObject({
  item,
  category,
  large = false,
  onOpen,
  onToggle,
  onDelete,
  onToggleFavorite,
  searchHits,
  showCategory = false,
}: ArchiveObjectProps) {
  const isDone = item.status === 'done'

  const highlightField = category?.field_schema.find(
    (field) => field.key !== 'title' && field.key !== 'notes' && item.metadata[field.key],
  )

  let preview: string | null = null
  let previewLabel: string | null = null
  if (searchHits && searchHits.length > 0) {
    previewLabel = searchHits[0].label
    preview = searchHits[0].value
  } else if (highlightField) {
    previewLabel = highlightField.label
    preview = String(item.metadata[highlightField.key])
  } else if (item.notes) {
    preview = item.notes
  }

  const accentColor = category?.color ?? 'var(--color-accent)'
  const rating = isDone ? averageRating(item) : null

  return (
    <article
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        // Let buttons inside the card handle their own activation.
        if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
        event.preventDefault()
        onOpen(item)
      }}
      className="vault-card group cursor-pointer select-none overflow-hidden"
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, archived item`}
    >
      {/* Active category accent — top edge hairline in category color */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: accentColor, opacity: 0.5 }}
        aria-hidden="true"
      />

      {/* Label strip — category identifier + status/actions */}
      <div className="relative flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          {showCategory && category ? (
            <CategoryIcon icon={category.icon} color={accentColor} size={13} />
          ) : category ? (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform"
              style={{ background: accentColor }}
            />
          ) : null}
          <span
            className="folio min-w-0 truncate text-[9px] tracking-[0.2em]"
            style={{ color: accentColor }}
          >
            {showCategory && category ? category.name : category?.name ?? 'Archive'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {rating != null ? (
            <span
              className="text-accent text-[9px] font-semibold"
              aria-label={`Rated ${rating} out of 5`}
            >
              ★ {rating}
            </span>
          ) : null}
          {onToggleFavorite ? (
            <FavoriteButton
              active={isFavorite(item)}
              label={isFavorite(item) ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
              onToggle={() => onToggleFavorite(item)}
              size={14}
              boxClassName="h-8 w-8"
            />
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(item)
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/30 transition-colors hover:bg-ink/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            title={`Delete ${item.title}`}
            aria-label={`Delete ${item.title}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Hairline divider */}
      <div className="mx-4 h-px bg-ink/[0.07]" />

      {/* Body — title + preview + thumbnail */}
      <div className={`flex gap-3 px-4 ${large ? 'py-5' : 'py-3.5'}`}>
        {/* Text */}
        <div className="min-w-0 flex-1">
          <h3
            className={`font-display font-semibold leading-[1.1] tracking-tight text-ink ${
              large ? 'text-[1.55rem] sm:text-[1.85rem]' : 'text-[1.05rem] sm:text-[1.2rem]'
            }`}
          >
            {item.title}
          </h3>

          {preview ? (
            <p className={`mt-2 line-clamp-2 leading-relaxed text-ink-soft ${large ? 'text-sm' : 'text-xs'}`}>
              {previewLabel ? (
                <span className="font-semibold text-ink/50 uppercase tracking-[0.1em] text-[9px] mr-1.5">
                  {previewLabel}
                </span>
              ) : null}
              {preview}
            </p>
          ) : null}
        </div>

        {/* Mounted specimen thumbnail — mobile stays clean at 2-up; returns sm+ */}
        {item.image_url ? (
          <div
            className={`relative hidden shrink-0 overflow-hidden border border-ink/10 sm:block ${
              large ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-16 w-16'
            }`}
          >
            <img
              src={item.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="vault-bevel pointer-events-none absolute inset-0" />
          </div>
        ) : null}
      </div>

      {/* Footer — date + completion toggle */}
      <div className="mx-4 h-px bg-ink/[0.07]" />
      <div className="flex flex-col items-start gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-ink-soft/40">
          {prettyDate.format(new Date(item.created_at))}
        </span>

        <div className="flex w-full shrink-0 items-center justify-end sm:w-auto">
          {/* Mark done → canonical DONE stamp (same completion language as Notes) */}
          <CompletionControl
            done={isDone}
            actionLabel={`Mark ${item.title} as done`}
            doneLabel={`Mark ${item.title} as saved`}
            onToggle={(event) => {
              event.stopPropagation()
              onToggle(item)
            }}
          />
        </div>
      </div>
    </article>
  )
}
