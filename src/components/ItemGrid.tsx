import { motion } from 'motion/react'
import { TiltCard } from './TiltCard'
import { ScrollReveal } from './ScrollReveal'
import type { Category, VaultItem } from '../types/app'

type ItemGridProps = {
  items: VaultItem[]
  categories: Category[]
  onOpen: (item: VaultItem) => void
  onToggle: (item: VaultItem) => void
}

const prettyDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
})

export function ItemGrid({ items, categories, onOpen, onToggle }: ItemGridProps) {
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
          <ScrollReveal key={item.id}>
            {/* The polaroid-deck hover: each card lifts forward in 3D space, fans slightly, and
                casts its reflection below — like leaning a photo deck forward to read a stack. */}
            <motion.div
              className="h-full"
              style={{ perspective: 900, transformStyle: 'preserve-3d' }}
              whileHover={{ rotateY: -6, rotateZ: 1, y: -8, z: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <TiltCard
                layoutId={`item-card-${item.id}`}
                onClick={() => onOpen(item)}
                className={`reflect-below cursor-pointer overflow-hidden p-0 ${isDone ? 'opacity-70' : ''}`}
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
              </TiltCard>
            </motion.div>
          </ScrollReveal>
        )
      })}
    </section>
  )
}
