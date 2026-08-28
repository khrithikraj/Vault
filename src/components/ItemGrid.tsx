import { motion } from 'motion/react'
import { TiltCard } from './TiltCard'
import { ScrollReveal } from './ScrollReveal'
import { Trash2 } from 'lucide-react'
import type { Category, VaultItem } from '../types/app'

type ItemGridProps = {
  items: VaultItem[]
  categories: Category[]
  onOpen: (item: VaultItem) => void
  onToggle: (item: VaultItem) => void
  onDelete: (item: VaultItem) => void
}

const prettyDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
})

export function ItemGrid({ items, categories, onOpen, onToggle, onDelete }: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="term-panel-soft border-ink/30 mt-4 rounded border-dashed p-10 text-center text-sm text-ink-soft">
        Nothing saved here yet — tap the + button to add your first memory.
      </div>
    )
  }

  return (
    <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((item) => {
        const category = categories.find((entry) => entry.id === item.category_id)
        const highlightField = category?.field_schema.find(
          (field) => field.key !== 'title' && field.key !== 'notes' && item.metadata[field.key],
        )
        const isDone = item.status === 'done'

        return (
          <ScrollReveal key={item.id} className="h-full">
            {/* Stable hover elevation: the card lifts a touch with a soft emphasis. No 3D
                rotation / scale oscillation so neighboring cards never shift or flicker. */}
            <motion.div
              className="h-full"
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              <TiltCard
                layoutId={`item-card-${item.id}`}
                onClick={() => onOpen(item)}
                className={`cursor-pointer overflow-hidden p-0 ${isDone ? 'opacity-70' : ''}`}
              >
                {item.image_url ? (
                  <div className="border-ink/20 relative border-b">
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-28 sm:h-32 w-full object-cover"
                    />
                    {/* Inner bevel: a whisper of light along the top edge, warm falloff below. */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        boxShadow:
                          'inset 0 1px 0 rgba(255,237,215,0.1), inset 0 -18px 28px -22px rgba(16,9,4,0.85)',
                      }}
                    />
                  </div>
                ) : null}

                {isDone ? (
                  <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <span className="border-accent text-accent -rotate-12 rounded-sm border-2 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.25em] opacity-90">
                      Done
                    </span>
                  </span>
                ) : null}

                <div className="flex items-start justify-between gap-2 p-3 sm:p-4">
                  {/* Text content: strictly constrained so long names never blow the grid */}
                  <div className="min-w-0 flex-1">
                    <h4
                      className="font-display line-clamp-2 font-semibold uppercase leading-snug break-words"
                      title={item.title}
                    >
                      {item.title}
                    </h4>
                    {highlightField ? (
                      <p className="mt-1 truncate text-xs sm:text-sm text-ink-soft">
                        <span className="font-medium">{highlightField.label}:</span>{' '}
                        {String(item.metadata[highlightField.key])}
                      </p>
                    ) : item.notes ? (
                      <p className="mt-1 line-clamp-2 text-xs sm:text-sm text-ink-soft">{item.notes}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-ink-soft/80">
                      {prettyDate.format(new Date(item.created_at))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggle(item)
                    }}
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium uppercase tracking-wide ${
                      isDone ? 'bg-ink text-cloud' : 'term-chip'
                    }`}
                  >
                    {isDone ? 'Done' : 'Mark'}
                  </button>
                </div>

                {/* Footer row: date + delete affordance, mirroring the Documents/Notes cards. */}
                <div className="flex items-center justify-between border-t border-dashed border-ink/15 p-3 pt-2 sm:p-4 sm:pt-2">
                  <span className="folio text-[10px] text-ink-soft/60">
                    #{item.id.slice(0, 4).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(item)
                    }}
                    className="term-chip rounded-full p-1.5 text-ink-soft/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete item"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </TiltCard>
            </motion.div>
          </ScrollReveal>
        )
      })}
    </section>
  )
}
