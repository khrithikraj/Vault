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
    <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => {
        const category = categories.find((entry) => entry.id === item.category_id)
        const highlightField = category?.field_schema.find(
          (field) => field.key !== 'title' && field.key !== 'notes' && item.metadata[field.key],
        )

        return (
          <ScrollReveal key={item.id}>
            <TiltCard
              layoutId={`item-card-${item.id}`}
              onClick={() => onOpen(item)}
              className={`cursor-pointer overflow-hidden p-0 ${item.status === 'done' ? 'opacity-60' : ''}`}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  className="border-ink/20 h-32 w-full border-b object-cover"
                />
              ) : null}
              <div className="flex items-start justify-between gap-2 p-4">
                <div>
                  <h4 className="font-semibold uppercase tracking-tight leading-snug">{item.title}</h4>
                  {highlightField ? (
                    <p className="mt-1 text-sm text-ink-soft">
                      <span className="font-medium">{highlightField.label}:</span>{' '}
                      {String(item.metadata[highlightField.key])}
                    </p>
                  ) : item.notes ? (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{item.notes}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-soft/80">
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
                    item.status === 'done' ? 'bg-ink text-cloud' : 'term-chip'
                  }`}
                >
                  {item.status === 'done' ? 'Done' : 'Mark'}
                </button>
              </div>
            </TiltCard>
          </ScrollReveal>
        )
      })}
    </section>
  )
}

