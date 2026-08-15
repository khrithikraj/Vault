import { useState } from 'react'
import { motion } from 'motion/react'
import { Settings } from 'lucide-react'
import { TiltCard } from './TiltCard'
import { ScrollReveal } from './ScrollReveal'
import { AnimatedNumber } from './AnimatedNumber'
import { BrandIcon, CategoryIcon } from '../lib/icons'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { Category } from '../types/app'

type CategoryRailProps = {
  categories: Category[]
  selectedCategoryId: string | null
  itemCountByCategory: Map<string, number>
  onSelect: (categoryId: string) => void
  onDelete: (categoryId: string) => void
  onAdd: (input: { name: string; icon: string; color: string }) => void
  onManageFields: (category: Category) => void
}

export function CategoryRail({
  categories,
  selectedCategoryId,
  itemCountByCategory,
  onSelect,
  onDelete,
  onAdd,
  onManageFields,
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
    onAdd({ name, icon, color })
    setName('')
    setIcon('✨')
    setShowForm(false)
  }

  return (
    <section
      aria-label="Categories"
      className="grid auto-rows-[minmax(150px,auto)] grid-cols-2 gap-4 lg:grid-cols-4"
    >
      {categories.map((category, index) => {
        const even = index % 2 === 0
        const count = itemCountByCategory.get(category.id) ?? 0
        return (
          <ScrollReveal key={category.id} className={index === 0 ? 'col-span-2' : ''} style={{overflowX:'hidden'}}>
            <motion.div
              className="h-full"
              style={{ perspective: 900, transformStyle: 'preserve-3d' }}
              onMouseEnter={() => setHoveredId(category.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <motion.div
                className="h-full"
                style={{ transformStyle: 'preserve-3d' }}
                {...(reducedMotion || hoveredId === category.id
                  ? {}
                  : {
                      animate: {
                        rotateY: even ? [0, 4, 0] : [0, -4, 0],
                        y: [0, -6, 0],
                        z: even ? [0, 12, 0] : [0, -6, 0],
                      },
                      transition: {
                        duration: 7 + (index % 3),
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: index * 0.5,
                      },
                    })}
              >
                <TiltCard
                  active={selectedCategoryId === category.id}
                  glowColor={category.color}
                  trailColor="rgba(220,80,0,0.85)"
                  onClick={() => onSelect(category.id)}
                  className={`flex h-full cursor-pointer flex-col justify-between ${
                    index === 0 ? 'p-6' : 'p-5'
                  } ${selectedCategoryId === category.id ? 'border-accent' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <CategoryIcon
                        icon={category.icon}
                        color={category.color}
                        size={index === 0 ? 28 : 22}
                      />
                      <div>
                        <h3
                          className={`font-display font-semibold uppercase leading-tight ${
                            index === 0 ? 'text-lg' : 'text-base'
                          }`}
                        >
                          {category.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-ink-soft">saved</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onManageFields(category)
                        }}
                        className="term-chip flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                        title="Customize fields"
                      >
                        <BrandIcon icon={Settings} size={14} /> Fields
                      </button>
                      {!category.is_default ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDelete(category.id)
                          }}
                          className="term-chip rounded-full px-2 py-1 text-xs"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-xs uppercase tracking-widest text-ink-soft/70">
                      {selectedCategoryId === category.id ? '[ viewing ]' : '—'}
                    </p>
                    <p className="font-display text-3xl font-medium leading-none text-ink/80">
                      <AnimatedNumber value={count} />
                    </p>
                  </div>
                </TiltCard>
              </motion.div>
            </motion.div>
          </ScrollReveal>
        )
      })}

      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="term-panel-soft border-ink/30 flex min-h-32 flex-col justify-center rounded border-dashed p-5"
      >
        {showForm ? (
          <form onSubmit={handleSubmit} className="grid gap-2">
            <div className="flex gap-2">
              <input
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
                maxLength={2}
                aria-label="Category icon"
                className="term-input w-12 rounded-none px-2 py-1.5 text-center"
              />
              <div
                className="border-ink/30 flex w-9 shrink-0 items-center justify-center rounded border"
                title="Icon preview"
              >
                <CategoryIcon icon={icon} color={color} size={18} />
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Category name"
                required
                className="term-input flex-1 rounded-none px-2 py-1.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Category color"
                className="border-ink/30 h-9 w-12 rounded border bg-transparent p-1"
              />
              <button
                type="submit"
                className="term-btn-primary flex-1 rounded-full px-3 py-2 text-sm font-medium uppercase tracking-wide"
              >
                Add category
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
          >
            [ + New category ]
          </button>
        )}
      </motion.div>
    </section>
  )
}
