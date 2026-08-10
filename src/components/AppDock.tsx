import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { Home, NotebookPen } from 'lucide-react'
import { BrandIcon, CategoryIcon } from '../lib/icons'
import type { Category } from '../types/app'

type AppDockProps = {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
  celebrateCategoryId?: string | null
  celebrateToken?: number
  notesActive: boolean
  onSelectNotes: () => void
}

/** Fixed bottom dock, macOS-style: a sliding active pill, plus real cursor-proximity
 * magnification (icons near the pointer grow and lift, not just the one under it). */
export function AppDock({
  categories,
  selectedCategoryId,
  onSelect,
  celebrateCategoryId,
  celebrateToken,
  notesActive,
  onSelectNotes,
}: AppDockProps) {
  const mouseX = useMotionValue(Infinity)

  return (
    <nav className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-3">
      <div
        onMouseMove={(event) => mouseX.set(event.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="term-panel flex max-w-full items-end gap-1 overflow-x-auto rounded-full px-2 py-2"
      >
        <DockButton
          mouseX={mouseX}
          label="All"
          renderIcon={(size) => <BrandIcon icon={Home} size={size} />}
          active={!notesActive && selectedCategoryId === null}
          onClick={() => onSelect(null)}
        />
        {categories.map((category) => (
          <DockButton
            key={category.id}
            mouseX={mouseX}
            dockKey={category.id}
            label={category.name}
            renderIcon={(size) => (
              <CategoryIcon icon={category.icon} color={category.color} size={size} />
            )}
            active={!notesActive && selectedCategoryId === category.id}
            onClick={() => onSelect(category.id)}
            celebrate={celebrateCategoryId === category.id ? celebrateToken : undefined}
          />
        ))}
        <div className="bg-ink/20 mx-1 h-8 w-px shrink-0 self-center" />
        <DockButton
          mouseX={mouseX}
          label="Notes"
          renderIcon={(size) => <BrandIcon icon={NotebookPen} size={size} />}
          active={notesActive}
          onClick={onSelectNotes}
        />
      </div>
    </nav>
  )
}

function DockButton({
  label,
  renderIcon,
  active,
  onClick,
  dockKey,
  celebrate,
  mouseX,
}: {
  label: string
  renderIcon: (size: number) => ReactNode
  active: boolean
  onClick: () => void
  dockKey?: string
  celebrate?: number
  mouseX: MotionValue<number>
}) {
  const ref = useRef<HTMLButtonElement>(null)

  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return Infinity
    return value - (bounds.left + bounds.width / 2)
  })
  const scale = useSpring(useTransform(distance, [-110, 0, 110], [1, 1.45, 1]), {
    stiffness: 300,
    damping: 18,
    mass: 0.4,
  })
  const lift = useTransform(scale, (value) => (value - 1) * -22)

  return (
    <motion.button
      ref={ref}
      type="button"
      data-dock-item={dockKey}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={`relative flex shrink-0 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
        active ? 'text-ink' : 'text-ink-soft'
      }`}
      title={label}
    >
      {active ? (
        <motion.span
          layoutId="dock-active-pill"
          className="bg-accent absolute inset-0 rounded-full"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      ) : null}
      <motion.span
        key={celebrate ?? 'idle'}
        initial={celebrate ? { scale: 1 } : false}
        animate={celebrate ? { scale: [1, 1.5, 1] } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 block"
      >
        <motion.span style={{ scale, y: lift }} className="block leading-none">
          {renderIcon(20)}
        </motion.span>
      </motion.span>
      <span className="relative z-10 max-w-14 truncate">{label}</span>
    </motion.button>
  )
}


