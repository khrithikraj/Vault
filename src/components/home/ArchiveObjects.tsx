import { AnimatePresence, motion } from 'motion/react'
import { ArchiveObject } from './ArchiveObject'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { Category, VaultItem } from '../../types/app'
import type { ItemFieldHit } from '../../lib/search'

type ArchiveObjectsProps = {
  items: VaultItem[]
  categories: Category[]
  onOpen: (item: VaultItem) => void
  onToggle: (item: VaultItem) => void
  onDelete: (item: VaultItem) => void
  /** Matched search fields per item id. */
  searchHits?: Map<string, ItemFieldHit[]>
  /** Show a category label strip (used in vault-wide search results). */
  showCategory?: boolean
}

/**
 * V2 — Archive object collection.
 *
 * Editorial asymmetric mosaic — NOT a uniform card grid.
 * First item = full-width LEAD OBJECT (larger format).
 * Remaining items = 2-column at ≥ sm, 1-column on mobile.
 *
 * Items animate in via spring stagger, animate out with scale collapse.
 * Layout animates smoothly when items are added/removed.
 */
export function ArchiveObjects({
  items,
  categories,
  onOpen,
  onToggle,
  onDelete,
  searchHits,
  showCategory = false,
}: ArchiveObjectsProps) {
  const reducedMotion = usePrefersReducedMotion()

  if (items.length === 0) {
    return (
      <div className="mt-4 border border-dashed border-ink/10 px-6 py-14 text-center">
        <p className="vault-meta text-ink-soft/35">This shelf is empty</p>
        <p className="mt-2 text-sm text-ink-soft/55">
          Nothing saved yet — tap{' '}
          <span className="font-semibold text-accent">+</span>{' '}
          to add your first object.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      layout
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5"
      style={{ overflowX: 'clip' }}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => {
          const category = categories.find((entry) => entry.id === item.category_id)
          const isLead = index === 0 && items.length > 1

          return (
            <motion.div
              key={item.id}
              layout
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, transition: { duration: 0.18 } }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 260,
                      damping: 28,
                      delay: Math.min(index, 10) * 0.04,
                    }
              }
              className={isLead ? 'sm:col-span-2' : ''}
            >
              <ArchiveObject
                item={item}
                category={category}
                large={isLead}
                showCategory={showCategory}
                searchHits={searchHits?.get(item.id)}
                onOpen={onOpen}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}
