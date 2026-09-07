import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { Check, ChevronRight, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../../lib/icons'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { Category, VaultItem } from '../../types/app'
import type { ItemFieldHit } from '../../lib/search'

type ArchiveObjectProps = {
  item: VaultItem
  category?: Category
  /** Larger lead object rendered first in the editorial arrangement. */
  large?: boolean
  onOpen: (item: VaultItem) => void
  onToggle: (item: VaultItem) => void
  onDelete: (item: VaultItem) => void
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
 * Depth: very subtle 3D tilt on desktop (max 2.2°), tiny lift on hover.
 * On touch: tap scale only, no tilt.
 */
export function ArchiveObject({
  item,
  category,
  large = false,
  onOpen,
  onToggle,
  onDelete,
  searchHits,
  showCategory = false,
}: ArchiveObjectProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [hovered, setHovered] = useState(false)

  const isDone = item.status === 'done'

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [-1.8, 1.8]), {
    stiffness: 280,
    damping: 28,
  })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [2.2, -2.2]), {
    stiffness: 280,
    damping: 28,
  })

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds || reducedMotion) return
    mx.set((event.clientX - bounds.left) / bounds.width - 0.5)
    my.set((event.clientY - bounds.top) / bounds.height - 0.5)
  }
  const onMouseLeave = () => {
    if (reducedMotion) return
    mx.set(0)
    my.set(0)
    setHovered(false)
  }
  const onMouseEnter = () => setHovered(true)

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
    <motion.article
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      style={
        reducedMotion
          ? undefined
          : { rotateX, rotateY, transformPerspective: 1000 }
      }
      whileHover={reducedMotion ? {} : { y: -3 }}
      whileTap={reducedMotion ? {} : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      onClick={() => onOpen(item)}
      className="archive-object group cursor-pointer select-none overflow-hidden"
      aria-label={`${item.title}, archived item`}
    >
      {/* Active category accent — top edge hairline in category color */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: accentColor, opacity: hovered ? 0.6 : 0.25 }}
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
          {isDone ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              <Check size={9} strokeWidth={3} aria-hidden="true" />
              Done
            </span>
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
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
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
            className="p-1.5 text-ink-soft/35 transition-colors hover:text-ink"
            aria-label={`Open ${item.title}`}
            title="View detail"
          >
            <ChevronRight size={12} />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(item)
            }}
            className="p-1.5 text-ink-soft/35 transition-colors hover:text-red-400"
            aria-label={`Delete ${item.title}`}
            title="Delete item"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.article>
  )
}
