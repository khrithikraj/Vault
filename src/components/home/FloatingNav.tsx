import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FolderLock, Heart, Home, NotebookPen, Trash2 } from 'lucide-react'
import { BrandIcon, CategoryIcon } from '../../lib/icons'
import { layers } from '../../design/layers'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { Category } from '../../types/app'

type FloatingNavProps = {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
  notesActive: boolean
  onSelectNotes: () => void
  docsActive: boolean
  onSelectDocs: () => void
  favoritesActive: boolean
  onSelectFavorites: () => void
  trashActive: boolean
  onSelectTrash: () => void
}

type NavItem = {
  key: string
  label: string
  icon: (size: number) => ReactNode
  active: boolean
  onClick: () => void
}

/**
 * V2 — Compact floating navigation.
 *
 * A slim dock island anchored at the bottom with safe-area awareness.
 * Primary items: All items / Notes / Documents / Favorites / Trash.
 * When categories exist, a category toggle reveals them inline.
 *
 * Features:
 * - Persistent labels on every input modality
 * - Active pill slides with Motion layoutId
 * - Horizontal scroll when many categories overflow
 */
export function FloatingNav({
  categories,
  selectedCategoryId,
  onSelect,
  notesActive,
  onSelectNotes,
  docsActive,
  onSelectDocs,
  favoritesActive,
  onSelectFavorites,
  trashActive,
  onSelectTrash,
}: FloatingNavProps) {
  const [showCategories, setShowCategories] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const isEverything =
    !notesActive && !docsActive && !trashActive && !favoritesActive && selectedCategoryId === null

  const primaryItems: NavItem[] = [
    {
      key: 'all',
      label: 'All items',
      icon: (size) => (
        <BrandIcon icon={Home} size={size} tone={isEverything ? 'ink' : 'accent'} />
      ),
      active: isEverything,
      onClick: () => {
        onSelect(null)
        setShowCategories(false)
      },
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: (size) => (
        <BrandIcon icon={NotebookPen} size={size} tone={notesActive ? 'ink' : 'accent'} />
      ),
      active: notesActive,
      onClick: onSelectNotes,
    },
    {
      key: 'docs',
      label: 'Documents',
      icon: (size) => (
        <BrandIcon icon={FolderLock} size={size} tone={docsActive ? 'ink' : 'accent'} />
      ),
      active: docsActive,
      onClick: onSelectDocs,
    },
    {
      key: 'favorites',
      label: 'Favorites',
      icon: (size) => (
        <BrandIcon icon={Heart} size={size} tone={favoritesActive ? 'ink' : 'accent'} />
      ),
      active: favoritesActive,
      onClick: onSelectFavorites,
    },
    {
      key: 'trash',
      label: 'Trash',
      icon: (size) => (
        <BrandIcon icon={Trash2} size={size} tone={trashActive ? 'ink' : 'accent'} />
      ),
      active: trashActive,
      onClick: onSelectTrash,
    },
  ]

  const categoryItems: NavItem[] = categories.map((category) => ({
    key: category.id,
    label: category.name,
    icon: (size) => (
      <CategoryIcon
        icon={category.icon}
        color={selectedCategoryId === category.id ? 'var(--color-ink)' : category.color}
        size={size}
      />
    ),
    active: selectedCategoryId === category.id,
    onClick: () => {
      onSelect(category.id)
      setShowCategories(false)
    },
  }))

  const activeCategoryItem = categoryItems.find((item) => item.active)
  const activeCategoryIndex = categories.findIndex((c) => c.id === selectedCategoryId)

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 flex justify-center px-3"
      style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 0.875rem)', zIndex: layers.navigation }}
    >
      <div
        className="float-nav flex max-w-full items-stretch gap-0.5 overflow-x-auto rounded-full px-2 py-1.5"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Category section — toggle + category pills */}
        {categories.length > 0 ? (
          <>
            {/* Category toggle button */}
            <NavButton
              reducedMotion={reducedMotion}
              item={{
                key: '__cat-toggle',
                label: activeCategoryItem?.label ?? 'Sections',
                icon: () => (
                  <span
                    className="font-display text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      color:
                        selectedCategoryId
                          ? 'var(--color-ink)'
                          : 'var(--color-ink-soft)',
                    }}
                  >
                    {activeCategoryIndex >= 0
                      ? String(activeCategoryIndex + 1).padStart(2, '0')
                      : '··'}
                  </span>
                ),
                active: !!selectedCategoryId,
                onClick: () => setShowCategories((prev) => !prev),
              }}
            />

            {/* Category pills — animated reveal */}
            <AnimatePresence initial={false}>
              {showCategories ? (
                <>
                  {categoryItems.map((item, index) => (
                    <motion.div
                      key={item.key}
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, x: -8 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, x: -8 }}
                      transition={reducedMotion
                        ? { duration: 0 }
                        : {
                            type: 'spring',
                            stiffness: 360,
                            damping: 28,
                            delay: index * 0.03,
                          }
                      }
                    >
                      <NavButton reducedMotion={reducedMotion} item={item} />
                    </motion.div>
                  ))}
                </>
              ) : activeCategoryItem ? (
                <motion.div
                  key={`single-${activeCategoryItem.key}`}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                >
                  <NavButton reducedMotion={reducedMotion} item={activeCategoryItem} />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Divider */}
            <span
              className="mx-1 h-6 w-px shrink-0 self-center bg-ink/10"
              aria-hidden="true"
            />
          </>
        ) : null}

        {/* Primary section items */}
        {primaryItems.map((item) => (
          <NavButton
            key={item.key}
            reducedMotion={reducedMotion}
            item={item}
          />
        ))}
      </div>
    </nav>
  )
}

function NavButton({
  item,
  reducedMotion,
}: {
  item: NavItem
  reducedMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={item.onClick}
      whileTap={{ scale: reducedMotion ? 1 : 0.86 }}
      className={`relative flex min-w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-2 py-1.5 transition-colors ${
        item.active ? 'text-ink' : 'text-ink-soft'
      }`}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      data-tour={item.key === 'favorites' ? 'nav-favorites' : undefined}
    >
      {/* Active background pill — slides via shared layoutId */}
      {item.active ? (
        <motion.span
          layoutId="floatnav-active-bg"
          className="absolute inset-0 rounded-full bg-[var(--accession-nav-active)]"
          style={{
            boxShadow:
              '0 6px 18px -4px rgba(196,72,0,0.65), inset 0 1px 0 rgba(245,234,216,0.15)',
          }}
          initial={false}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 400, damping: 32 }
          }
        />
      ) : null}

      <span className="relative z-10 block leading-none">
        {item.icon(18)}
      </span>
      <span className="relative z-10 max-w-16 truncate text-[9px] font-medium leading-none text-current">
        {item.label}
      </span>
    </motion.button>
  )
}
