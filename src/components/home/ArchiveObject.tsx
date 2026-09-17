import { ChevronRight, Check, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../../lib/icons'
import { DoneStamp } from '../DoneStamp'
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
 * A premium editorial record card — not a plain rectangle.
 * The design reads as a physical archive slip: top "label strip" with category
 * marker and serial, title-first body with optional specimen thumbnail,
 * footer with date, mark-done toggle and soft delete.
 *
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

  return (
    <article
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(item)
        }
      }}
      className="archive-object group cursor-pointer select-none overflow-hidden"
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

      {/* Label strip — category identifier + serial */}
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
            className="folio truncate text-[9px] tracking-[0.2em]"
            style={{ color: accentColor }}
          >
            {showCategory && category ? category.name : category?.name ?? 'Archive'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDone ? <DoneStamp variant="pill" /> : null}
          {isDone && averageRating(item) != null ? (
            <span className="text-accent text-[9px] font-semibold">★ {averageRating(item)}</span>
          ) : null}
          {onToggleFavorite ? (
            <FavoriteButton
              active={isFavorite(item)}
              label={isFavorite(item) ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
              onToggle={() => onToggleFavorite(item)}
              size={14}
            />
          ) : null}
          <span className="font-display text-[9px] tracking-[0.18em] text-ink-soft/35">
            #{item.id.slice(0, 6).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Hairline divider */}
      <div className="mx-4 h-px bg-ink/[0.07]" />

      {/* Body — title + preview + thumbnail */}
      <div className={`flex gap-4 px-4 ${large ? 'py-5' : 'py-4'}`}>
        {/* Text */}
        <div className="min-w-0 flex-1">
          <h3
            className={`font-display font-semibold leading-[1.1] tracking-tight text-ink ${
              large ? 'text-[1.55rem] sm:text-[1.85rem]' : 'text-[1.1rem] sm:text-[1.2rem]'
            }`}
          >
            {item.title}
          </h3>

          {preview ? (
            <p className={`mt-2.5 line-clamp-2 leading-relaxed text-ink-soft ${large ? 'text-sm' : 'text-xs'}`}>
              {previewLabel ? (
                <span className="font-semibold text-ink/50 uppercase tracking-[0.1em] text-[9px] mr-1.5">
                  {previewLabel}
                </span>
              ) : null}
              {preview}
            </p>
          ) : null}
        </div>

        {/* Mounted specimen thumbnail */}
        {item.image_url ? (
          <div
            className={`relative shrink-0 overflow-hidden border border-ink/10 ${
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

      {/* Footer */}
      <div className="mx-4 h-px bg-ink/[0.06]" />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="text-[9px] uppercase tracking-[0.16em] text-ink-soft/40">
          {prettyDate.format(new Date(item.created_at))}
        </span>

        <div className="flex items-center gap-1">
          {/* Mark done / restore */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(item)
            }}
            className={`flex min-h-9 items-center gap-1 rounded px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              isDone
                ? 'bg-accent/20 text-accent hover:bg-accent hover:text-ink'
                : 'text-ink-soft/50 hover:text-ink'
            }`}
            aria-label={isDone ? `Mark ${item.title} as saved` : `Mark ${item.title} as done`}
          >
            {isDone ? (
              <>
                <Check size={9} strokeWidth={3} aria-hidden="true" /> Done
              </>
            ) : (
              'Mark'
            )}
          </button>

          {/* Open */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpen(item)
            }}
            className="inline-flex h-9 w-9 items-center justify-center text-ink-soft/35 transition-colors hover:text-ink"
            aria-label={`Open ${item.title}`}
            title="View detail"
          >
            <ChevronRight size={14} />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(item)
            }}
            className="inline-flex h-9 w-9 items-center justify-center text-ink-soft/35 transition-colors hover:text-red-400"
            aria-label={`Delete ${item.title}`}
            title="Delete item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  )
}
