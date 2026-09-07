import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { FolderLock, Home, NotebookPen, Trash2 } from 'lucide-react'
import { BrandIcon, CategoryIcon } from '../../lib/icons'
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
 * Primary items: Everything / Notes / Documents / Trash.
 * When categories exist, a category toggle reveals them inline.
 *
 * Features:
 * - Cursor-proximity magnification on desktop (subtle, spring-based)
 * - Tooltip labels on desktop hover
 * - Always-readable on touch (no hover dependency)
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
  trashActive,
  onSelectTrash,
}: FloatingNavProps) {
  const mouseX = useMotionValue(Infinity)
  const [showCategories, setShowCategories] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const isEverything = !notesActive && !docsActive && !trashActive && selectedCategoryId === null

  const primaryItems: NavItem[] = [
    {
      key: 'all',
      label: 'Everything',
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
      className="fixed inset-x-0 z-30 flex justify-center px-3"
      style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 0.875rem)' }}
    >
      <div
        onMouseMove={(event) => mouseX.set(event.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="float-nav flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full px-2 py-1.5"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Category section — toggle + category pills */}
        {categories.length > 0 ? (
          <>
            {/* Category toggle button */}
            <NavButton
              mouseX={mouseX}
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
                      <NavButton mouseX={mouseX} reducedMotion={reducedMotion} item={item} />
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
                  <NavButton mouseX={mouseX} reducedMotion={reducedMotion} item={activeCategoryItem} />
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
            mouseX={mouseX}
            reducedMotion={reducedMotion}
            item={item}
          />
        ))}
      </div>
    </nav>
  )
}

function NavButton({
  mouseX,
  item,
  reducedMotion,
}: {
  mouseX: MotionValue<number>
  item: NavItem
  reducedMotion: boolean
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [tooltip, setTooltip] = useState(false)

  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return Infinity
    return value - (bounds.left + bounds.width / 2)
  })
  const scale = useSpring(
    useTransform(distance, [-100, 0, 100], [1, 1.24, 1]),
    { stiffness: 340, damping: 22, mass: 0.35 },
  )

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={item.onClick}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
      whileTap={{ scale: reducedMotion ? 1 : 0.86 }}
      className={`relative flex shrink-0 flex-col items-center justify-center rounded-full px-2.5 py-1.5 transition-colors ${
        item.active ? 'text-ink' : 'text-ink-soft'
      }`}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
    >
      {/* Active background pill — slides via shared layoutId */}
      {item.active ? (
        <motion.span
          layoutId="floatnav-active-bg"
          className="absolute inset-0 rounded-full bg-accent"
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

      {/* Icon */}
      <motion.span
        style={{ scale: reducedMotion ? 1 : scale }}
        className="relative z-10 block leading-none"
      >
        {item.icon(18)}
      </motion.span>

      {/* Tooltip — desktop hover only, above the button */}
      <motion.span
        initial={false}
        animate={{
          opacity: tooltip && !reducedMotion ? 1 : 0,
          y: tooltip && !reducedMotion ? 0 : 4,
          pointerEvents: tooltip && !reducedMotion ? 'auto' : 'none',
        }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        className={`pointer-events-none absolute -top-9 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${
          item.active
            ? 'border-accent/30 bg-cloud text-ink'
            : 'border-ink/10 bg-cloud text-ink-soft'
        }`}
      >
        {item.label}
      </motion.span>
    </motion.button>
  )
}
