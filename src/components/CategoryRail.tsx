import { useState } from 'react'
import { motion } from 'motion/react'
import { Pencil, Trash2 } from 'lucide-react'
import { TiltCard } from './TiltCard'
import { ScrollReveal } from './ScrollReveal'
import { AnimatedNumber } from './AnimatedNumber'
import { CategoryIcon } from '../lib/icons'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { Category } from '../types/app'

type CategoryRailProps = {
  categories: Category[]
  selectedCategoryId: string | null
  itemCountByCategory: Map<string, number>
  onSelect: (categoryId: string) => void
  onDelete: (categoryId: string) => void
  onAdd: (input: { name: string; icon: string; color: string }) => void
  onEdit: (category: Category) => void
}

export function CategoryRail({
  categories,
  selectedCategoryId,
  itemCountByCategory,
  onSelect,
  onDelete,
  onAdd,
  onEdit,
}: CategoryRailProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('✨')
  const [color, setColor] = useState('#dbe9ff')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      return
    }
    onAdd({
      name: name.trim(),
      icon: icon.trim() || '✨',
      color,
    })
    setName('')
    setIcon('✨')
    setShowForm(false)
  }

  return (
    <section
      aria-label="Categories"
      className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 overflow-x-clip"
    >
      {categories.map((category, index) => {
        const count = itemCountByCategory.get(category.id) ?? 0
        const isHovered = hoveredId === category.id
        return (
          <ScrollReveal
            key={category.id}
            className={index === 0 ? 'sm:col-span-2' : ''}
            style={{ overflowX: 'clip' }}
          >
            {/* Use a plain div wrapper whose pointer events trigger the hover state.
                The inner TiltCard and buttons inherit pointer events normally but we
                guard against child boundaries causing flicker by using onPointerEnter
                which fires once per entry into the entire subtree. */}
            <div
              className="h-full"
              onPointerEnter={() => setHoveredId(category.id)}
              onPointerLeave={() => setHoveredId(null)}
            >
              {/* Stable card: a gentle vertical breathing only — no 3D rotateY/z projection,
                  which overhung the grid and produced an unwanted horizontal scrollbar. */}
              <motion.div
                className="h-full"
                animate={reducedMotion ? { y: 0 } : isHovered ? { y: -3 } : { y: [0, -4, 0] }}
                transition={
                  isHovered
                    ? { duration: 0.2, ease: 'easeOut' }
                    : { duration: 7 + (index % 3), repeat: Infinity, ease: 'easeInOut', delay: index * 0.5 }
                }
              >
                  <TiltCard
                    active={selectedCategoryId === category.id}
                    glowColor={category.color}
                    trailColor="rgba(220,80,0,0.85)"
                    onClick={() => onSelect(category.id)}
                    className={`flex h-full cursor-pointer flex-col justify-between p-4 sm:p-5 ${
                      selectedCategoryId === category.id ? 'border-accent' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: icon + name — clamp to available width */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="shrink-0">
                          <CategoryIcon
                            icon={category.icon}
                            color={category.color}
                            size={index === 0 ? 26 : 22}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3
                            className={`font-display font-semibold uppercase leading-tight truncate max-w-full ${
                              index === 0 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                            }`}
                            title={category.name}
                          >
                            {category.name}
                          </h3>
                          <p className="mt-0.5 text-xs text-ink-soft">saved</p>
                        </div>
                      </div>

                      {/* Right: action buttons — shrink-0 so they never get pushed off */}
                      <div className="flex shrink-0 items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onEdit(category)
                          }}
                          className="term-chip flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink hover:text-ink font-medium whitespace-nowrap"
                          title="Edit category"
                        >
                          <Pencil size={12} />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        {!category.is_default ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDelete(category.id)
                            }}
                            className="term-chip rounded-full p-1.5 text-xs text-ink-soft hover:text-red-400"
                            title="Remove category"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="text-xs uppercase tracking-widest text-ink-soft/70 truncate">
                        {selectedCategoryId === category.id ? '[ viewing ]' : '—'}
                      </p>
                      <p className="font-display text-2xl sm:text-3xl font-medium leading-none text-ink/85 shrink-0">
                        <AnimatedNumber value={count} />
                      </p>
                    </div>
                  </TiltCard>
                </motion.div>
            </div>
          </ScrollReveal>
        )
      })}

      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="term-panel-soft border-ink/30 flex min-h-[140px] flex-col justify-center rounded border-dashed p-4 sm:p-5"
      >
        {showForm ? (
          <form onSubmit={handleSubmit} className="grid gap-2.5">
            <div className="flex items-center gap-2">
              <input
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
                maxLength={4}
                aria-label="Category icon"
                className="term-input w-12 rounded-none px-1.5 py-1.5 text-center text-sm"
              />
              <div
                className="border-ink/30 flex h-9 w-9 shrink-0 items-center justify-center rounded border"
                title="Icon preview"
              >
                <CategoryIcon icon={icon} color={color} size={18} />
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Category name"
                required
                className="term-input min-w-0 flex-1 rounded-none px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Category color"
                className="border-ink/30 h-9 w-12 cursor-pointer rounded border bg-transparent p-1 shrink-0"
              />
              <button
                type="submit"
                className="term-btn-primary flex-1 rounded-full px-3 py-2 text-xs sm:text-sm font-semibold uppercase tracking-wide"
              >
                Add category
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border-ink/30 rounded-outline border px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full py-4 text-center text-xs sm:text-sm font-semibold uppercase tracking-widest text-ink-soft hover:text-ink transition-colors"
          >
            [ + New category ]
          </button>
        )}
      </motion.div>
    </section>
  )
}