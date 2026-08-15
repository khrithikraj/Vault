import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { FIELD_TYPE_OPTIONS, makeFieldKey } from '../lib/fields'
import { CategoryIcon } from '../lib/icons'
import type { Category, FieldDefinition, FieldType } from '../types/app'

type CategoryFieldEditorProps = {
  category: Category | null
  onClose: () => void
  onSave: (categoryId: string, fields: FieldDefinition[]) => void
}

/** Lets you redesign what a category asks for — add/rename/reorder/retype/remove fields anytime. */
export function CategoryFieldEditor({ category, onClose, onSave }: CategoryFieldEditorProps) {
  const [fields, setFields] = useState<FieldDefinition[]>([])

  // Sync local fields state whenever the category prop changes (e.g. user opens a
  // different category's editor). Using useEffect avoids the render-time setState
  // anti-pattern and keeps strict-mode safe.
  useEffect(() => {
    if (category) {
      setFields(category.field_schema.length > 0 ? category.field_schema : [])
    }
  }, [category])

  const updateField = (index: number, patch: Partial<FieldDefinition>) => {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    )
  }

  const removeField = (index: number) => {
    setFields((current) => current.filter((_, i) => i !== index))
  }

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) {
        return current
      }
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const addField = () => {
    setFields((current) => [
      ...current,
      {
        key: makeFieldKey(`Field ${current.length + 1}`, current),
        label: '',
        type: 'text' as FieldType,
        required: false,
      },
    ])
  }

  const handleSave = () => {
    if (!category) {
      return
    }
    const cleaned = fields
      .map((field) => ({ ...field, label: field.label.trim() || 'Untitled field' }))
      .filter((field) => field.key === 'title' || field.label.length > 0)
    onSave(category.id, cleaned)
    onClose()
  }

  return (
    <AnimatePresence>
      {category ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className="term-panel term-brackets term-scrollbar max-h-[85vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Customize fields
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
                  <CategoryIcon icon={category.icon} color={category.color} size={22} />
                  {category.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="term-chip rounded-full px-3 py-1 text-sm uppercase tracking-wide"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {fields.map((field, index) => (
                <motion.div
                  layout
                  key={`${field.key}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="term-panel-soft grid gap-2 rounded p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={field.label}
                      onChange={(event) => updateField(index, { label: event.target.value })}
                      placeholder="Field label"
                      disabled={field.key === 'title'}
                      className="term-input min-w-0 flex-1 rounded-none px-2.5 py-1.5 text-sm disabled:opacity-60"
                    />
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        className="term-chip rounded-full px-2 py-1.5 text-xs disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(index, 1)}
                        disabled={index === fields.length - 1}
                        className="term-chip rounded-full px-2 py-1.5 text-xs disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      {field.key !== 'title' ? (
                        <button
                          type="button"
                          onClick={() => removeField(index)}
                          className="border-ink/30 rounded-outline border px-2 py-1.5 text-xs text-ink-soft hover:text-ink"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateField(index, { type: event.target.value as FieldType })
                      }
                      disabled={field.key === 'title'}
                      className="term-input rounded-none px-2 py-1.5 text-xs disabled:opacity-60"
                    >
                      {FIELD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-soft">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                        disabled={field.key === 'title'}
                      />
                      Required
                    </label>
                  </div>
                </motion.div>
              ))}
            </div>

            <button
              type="button"
              onClick={addField}
              className="border-ink/30 rounded-outline mt-3 w-full border-2 border-dashed py-2.5 text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              + Add field
            </button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleSave}
              className="term-btn-primary mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold uppercase tracking-widest"
            >
              Save fields
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
