import { AnimatePresence, motion } from 'motion/react'
import { CategoryIcon } from '../lib/icons'
import type { Category, VaultItem } from '../types/app'

type ItemDetailOverlayProps = {
  item: VaultItem | null
  category?: Category
  onClose: () => void
  onToggle: (item: VaultItem) => void
  onDelete: (itemId: string) => void
}

const prettyDateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Morphing-dialog style overlay: expands from the tapped card via matching layoutId. */
export function ItemDetailOverlay({
  item,
  category,
  onClose,
  onToggle,
  onDelete,
}: ItemDetailOverlayProps) {
  const metadataFields = category?.field_schema.filter(
    (field) => field.key !== 'title' && field.key !== 'notes' && item?.metadata[field.key],
  )

  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            layoutId={`item-card-${item.id}`}
            onClick={(event) => event.stopPropagation()}
            className="term-panel term-brackets w-full max-w-lg overflow-hidden rounded p-7"
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                className="border-ink/20 -mx-7 -mt-7 mb-5 h-56 w-[calc(100%+3.5rem)] border-b object-cover"
              />
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <div>
                {category ? (
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    <CategoryIcon icon={category.icon} color={category.color} size={14} />
                    {category.name}
                  </p>
                ) : null}
                <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight">{item.title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="term-chip rounded-full px-3 py-1 text-sm uppercase tracking-wide"
              >
                Close
              </button>
            </div>

            {metadataFields && metadataFields.length > 0 ? (
              <dl className="mt-4 grid gap-2">
                {metadataFields.map((field) => (
                  <div key={field.key} className="flex gap-2 text-sm">
                    <dt className="w-32 shrink-0 font-medium uppercase tracking-wide text-ink-soft">
                      {field.label}
                    </dt>
                    <dd className="text-ink">
                      {field.type === 'currency' ? '₹' : ''}
                      {String(item.metadata[field.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {item.notes ? (
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{item.notes}</p>
            ) : !metadataFields?.length ? (
              <p className="mt-4 text-sm italic text-ink-soft/70">No notes added yet.</p>
            ) : null}

            <p className="mt-4 text-xs uppercase tracking-widest text-ink-soft/80">
              Saved {prettyDateTime.format(new Date(item.created_at))}
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => onToggle(item)}
                className={`term-btn-primary flex-1 rounded-full px-4 py-2.5 text-sm font-medium uppercase tracking-wide ${
                  item.status === 'done' ? 'opacity-70' : ''
                }`}
              >
                {item.status === 'done' ? 'Marked as done' : 'Mark as done'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(item.id)
                  onClose()
                }}
                className="border-ink/30 rounded-outline border px-4 py-2.5 text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
