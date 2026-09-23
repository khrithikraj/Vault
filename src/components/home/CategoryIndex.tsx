import { useState } from 'react'
import { motion } from 'motion/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'
import { CategoryIcon } from '../../lib/icons'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { ConfirmDialog } from '../ConfirmDialog'
import type { Category } from '../../types/app'

type CategoryIndexProps = {
  categories: Category[]
  selectedCategoryId: string | null
  itemCountByCategory: Map<string, number>
  onSelect: (categoryId: string) => void
  onDelete: (categoryId: string) => void
  onAdd: (input: { name: string; description: string; icon: string; color: string }) => void
  onEdit: (category: Category) => void
}

/**
 * V2 — Category Index.
 *
 * Category table of contents:
 *   01   FOOD SPOTS ············ 04
 *   02   SHOPPING ·············· 12
 *   03   TRAVEL ················ 03
 *
 * The active row gets a left-edge accent line that glides via Motion layoutId.
 * Count numbers are animated and actions remain available on every input mode.
 */
export function CategoryIndex({
  categories,
  selectedCategoryId,
  itemCountByCategory,
  onSelect,
  onDelete,
  onAdd,
  onEdit,
}: CategoryIndexProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('✨')
  const [color, setColor] = useState('#c44800')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), description: description.trim(), icon: icon.trim() || '✨', color })
    setName('')
    setDescription('')
    setIcon('✨')
    setShowForm(false)
  }

  if (categories.length === 0 && !showForm) {
    return (
      <div className="mt-4 border border-dashed border-ink/12 px-6 py-12 text-center">
        <p className="vault-meta text-ink-soft/45">No categories yet</p>
        <p className="mt-2 text-sm text-ink-soft/70">Create a category to define how its items are captured.</p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="vault-action mt-4 inline-flex items-center gap-2 border border-ink/15 px-4 py-2 text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          <Plus size={13} aria-hidden="true" />
          New category
        </button>
      </div>
    )
  }

  return (
    <motion.div layout aria-label="Category index" className="mt-2">
      {/* Rail header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="folio text-[9px] tracking-[0.28em] text-ink-soft/50">Category index</span>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="vault-action flex items-center gap-1.5 text-[10px] text-ink-soft/45 transition-colors hover:text-accent"
        >
          <Plus size={11} aria-hidden="true" />
          New category
        </button>
      </div>

      {/* Category rows */}
      <motion.div layout className="relative">
        {/* Gliding active left-edge indicator */}
        {selectedCategoryId ? (
          <motion.div
            layoutId="cat-index-active"
            className="pointer-events-none absolute inset-y-0 left-0 w-[2px]"
            style={{ background: 'var(--color-accent)' }}
            initial={false}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 400, damping: 32 }
            }
          />
        ) : null}

        {categories.map((category, index) => {
          const active = selectedCategoryId === category.id
          const count = itemCountByCategory.get(category.id) ?? 0

          return (
            <motion.div
              layout
              key={category.id}
              transition={
                reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }
              }
            >
              <div
                className={`index-row group flex items-center gap-3 py-3 sm:gap-4 ${
                  active ? 'pl-4 sm:pl-5' : 'pl-3 sm:pl-4'
                } pr-3 sm:pr-4`}
              >
                {/* Index number */}
                <span
                  className={`folio w-6 shrink-0 text-[10px] tabular-nums ${
                    active ? 'text-accent' : 'text-[var(--accession-text-muted)]'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                {/* Category icon + name — tap to select */}
                <button
                  type="button"
                  onClick={() => onSelect(category.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-current={active ? 'true' : undefined}
                >
                  <CategoryIcon
                    icon={category.icon}
                    color={active ? 'var(--color-ink)' : category.color}
                    size={16}
                  />
                  <span
                    className={`font-display min-w-0 break-words text-sm leading-snug transition-colors ${
                      active ? 'font-semibold text-ink' : 'font-medium text-ink/75'
                    }`}
                    title={category.name}
                  >
                    {category.name}
                  </span>
                </button>

                {/* Dot leaders — visual table-of-contents effect */}
                <span
                  className="hidden min-w-0 flex-1 overflow-hidden text-ink-soft/15 sm:block"
                  aria-hidden="true"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, currentColor 1px, transparent 1px)',
                    backgroundSize: '4px 1px',
                    backgroundRepeat: 'repeat-x',
                    backgroundPosition: 'center',
                    height: '1px',
                  }}
                />

                {/* Count */}
                <span
                  className={`font-display shrink-0 text-base tabular-nums ${
                    active ? 'font-semibold text-ink' : 'font-medium text-ink/40'
                  }`}
                >
                  <AnimatedNumber value={count} />
                </span>

                {/* Edit + delete actions */}
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onEdit(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-soft/55 transition-colors hover:text-ink"
                    aria-label={`Edit ${category.name}`}
                    title="Edit category"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-soft/55 transition-colors hover:text-red-400"
                    aria-label={`Delete ${category.name}`}
                    title="Remove category"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            </motion.div>
          )
        })}

        {/* Add section form */}
        {showForm ? (
          <motion.form
            layout
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            onSubmit={handleSubmit}
            className="index-row grid gap-2 px-3 py-3 sm:px-4"
          >
            <div className="flex items-center gap-2">
              <input
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
                maxLength={4}
                aria-label="Category icon"
                className="vault-input w-11 px-1.5 py-1.5 text-center text-sm"
              />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Category name"
                required
                autoFocus
                className="vault-input min-w-0 flex-1 px-2.5 py-1.5 text-sm"
              />
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Category color"
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-ink/25 bg-transparent p-1"
              />
              <button
                type="submit"
                className="shrink-0 bg-accent border border-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="shrink-0 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft/50 transition-colors hover:text-ink-soft"
              >
                Cancel
              </button>
            </div>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="One-line description (e.g. Receipts I need to track)"
              className="vault-input w-full rounded-none px-2.5 py-1.5 text-xs text-ink-soft"
            />
          </motion.form>
        ) : null}
      </motion.div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete category?"
        message={
          <>
            This will permanently delete <strong>{deleteTarget?.name}</strong> and all items stored in it.
          </>
        }
        confirmLabel="Delete category"
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </motion.div>
  )
}
