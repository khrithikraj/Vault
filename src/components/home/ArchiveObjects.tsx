import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { ArchiveObject } from './ArchiveObject'
import { VaultEmptyState } from '../ui/VaultEmptyState'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { motionTokens } from '../../design/motion'
import type { Category, VaultItem } from '../../types/app'
import type { ItemFieldHit } from '../../lib/search'

type ArchiveObjectsProps = {
  items: VaultItem[]
  categories: Category[]
  onOpen: (item: VaultItem) => void
  onToggle: (item: VaultItem) => void
  onDelete: (item: VaultItem) => void
  onToggleFavorite?: (item: VaultItem) => void
  /** Matched search fields per item id. */
  searchHits?: Map<string, ItemFieldHit[]>
  /** Show a category label strip (used in vault-wide search results). */
  showCategory?: boolean
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
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
  onToggleFavorite,
  searchHits,
  showCategory = false,
  emptyTitle = 'No items yet',
  emptyDescription = 'Use Add item to file your first entry.',
}: ArchiveObjectsProps) {
  const reducedMotion = usePrefersReducedMotion()

  if (items.length === 0) {
    return (
      <VaultEmptyState
        className="mt-4"
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <motion.div
      // "position" only — full layout mode projects scale corrections onto every
      // nested motion child (e.g. DoneStamp), hijacking their own mount animations.
      layout="position"
      className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4"
      style={{ overflowX: 'clip' }}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => {
          const category = categories.find((entry) => entry.id === item.category_id)
          const isLead = index === 0 && items.length > 1

          return (
            <motion.div
              key={item.id}
              layout="position"
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 12 }
              }
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0 }
              }
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transition: motionTokens.micro }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                    : { ...motionTokens.standard, delay: Math.min(index, 8) * 0.025 }
              }
                  className={isLead ? 'sm:col-span-12' : 'sm:col-span-6'}
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
                onToggleFavorite={onToggleFavorite}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}
