import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Plus, Trash2, X, Sliders, Palette, Check } from 'lucide-react'
import { FIELD_TYPE_OPTIONS, makeFieldKey } from '../lib/fields'
import { CategoryIcon } from '../lib/icons'
import type { Category, FieldDefinition, FieldType } from '../types/app'

export type CategoryEditorProps = {
  category: Category | null
  onClose: () => void
  onSave: (
    id: string,
    name: string,
    icon: string,
    color: string,
    fieldSchema: FieldDefinition[],
  ) => void
}

const PRESET_EMOJIS = ['📁', '🔑', '💳', '📝', '🏷️', '💡', '🌐', '📦', '🎯', '🚀', '💻', '🏠', '🍔', '✈️', '📚', '✨', '🔒', '⚡']

const PRESET_COLORS = [
  '#dbe9ff', // Soft sky
  '#dc5000', // Ember
  '#f2b134', // Gold
  '#4ade80', // Mint / green
  '#c084fc', // Lavender
  '#fb7185', // Coral
  '#38bdf8', // Cyan
  '#a3e635', // Lime
  '#f472b6', // Pink
  '#94a3b8', // Slate
]

export function CategoryEditor({ category, onClose, onSave }: CategoryEditorProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'fields'>('general')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('✨')
  const [color, setColor] = useState('#dbe9ff')
  const [fields, setFields] = useState<FieldDefinition[]>([])

  useEffect(() => {
    if (category) {
      setName(category.name)
      setIcon(category.icon || '✨')
      setColor(category.color || '#dbe9ff')
      setFields(category.field_schema.length > 0 ? category.field_schema : [])
    }
  }, [category])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

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
    if (!category) return
    const cleanedFields = fields
      .map((field) => ({ ...field, label: field.label.trim() || 'Untitled field' }))
      .filter((field) => field.key === 'title' || field.label.length > 0)

    onSave(
      category.id,
      name.trim() || 'Untitled Category',
      icon.trim() || '✨',
      color,
      cleanedFields,
    )
    onClose()
  }

  return (
    <AnimatePresence>
      {category && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="term-panel term-brackets term-scrollbar relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded p-4 sm:p-6"
            style={{ transformPerspective: 1200 }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-ink/15 pb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink/20"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <CategoryIcon icon={icon} color={color} size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
                    Edit category
                  </p>
                  <h2 className="font-display truncate text-lg sm:text-xl font-bold uppercase tracking-tight text-ink">
                    {name.trim() || 'Category'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="term-chip shrink-0 rounded-full p-2 text-ink-soft hover:text-ink"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-3 flex gap-2 border-b border-ink/10 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  activeTab === 'general'
                    ? 'term-btn-primary'
                    : 'border border-ink/20 text-ink-soft hover:text-ink'
                }`}
              >
                <Palette size={13} /> Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fields')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  activeTab === 'fields'
                    ? 'term-btn-primary'
                    : 'border border-ink/20 text-ink-soft hover:text-ink'
                }`}
              >
                <Sliders size={13} /> Fields ({fields.length})
              </button>
            </div>

            {/* Content area with smooth scrolling */}
            <div className="term-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-4 pr-1">
              {activeTab === 'general' ? (
                <div className="grid gap-4">
                  {/* Category Name */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                      Category name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Passwords, Receipts, Ideas"
                      className="term-input mt-1.5 w-full rounded-none px-3.5 py-2.5 text-base font-medium text-ink"
                    />
                  </div>

                  {/* Icon Selection */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                      Icon & Emoji
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        maxLength={4}
                        aria-label="Custom emoji icon"
                        className="term-input h-10 w-14 rounded-none px-2 text-center text-lg text-ink"
                      />
                      <span className="text-xs text-ink-soft">Custom icon or pick below:</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setIcon(emoji)}
                          className={`flex h-8 w-8 items-center justify-center rounded border text-sm transition-transform ${
                            icon === emoji
                              ? 'border-ink bg-ink/20 scale-110'
                              : 'border-ink/20 hover:border-ink/40 bg-ink/5'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Selection */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                      Accent Color
                    </label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setColor(preset)}
                          style={{ backgroundColor: preset }}
                          className={`flex h-7 w-7 items-center justify-center rounded-full border border-black/30 transition-transform ${
                            color.toLowerCase() === preset.toLowerCase()
                              ? 'ring-2 ring-ink ring-offset-2 ring-offset-cloud scale-110'
                              : 'hover:scale-105'
                          }`}
                          aria-label={`Color preset ${preset}`}
                        >
                          {color.toLowerCase() === preset.toLowerCase() && (
                            <Check size={13} className="text-cloud" />
                          )}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 pl-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          aria-label="Custom color picker"
                          className="h-7 w-8 cursor-pointer rounded border border-ink/30 bg-transparent p-0"
                        />
                        <span className="font-mono text-xs text-ink-soft">{color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-soft">
                      Define the custom fields captured when adding items to this category.
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    {fields.map((field, index) => (
                      <motion.div
                        layout
                        key={`${field.key}-${index}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="term-panel-soft grid gap-2 rounded border border-ink/15 p-3"
                      >
                        {/* Top row: Label & order controls */}
                        <div className="flex items-center gap-2">
                          <input
                            value={field.label}
                            onChange={(event) => updateField(index, { label: event.target.value })}
                            placeholder="Field label (e.g. Website, Price, Username)"
                            disabled={field.key === 'title'}
                            className="term-input min-w-0 flex-1 rounded-none px-2.5 py-1.5 text-sm disabled:opacity-60"
                          />
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveField(index, -1)}
                              disabled={index === 0}
                              className="term-chip rounded-full p-1.5 text-ink-soft hover:text-ink disabled:opacity-20"
                              aria-label="Move up"
                              title="Move up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveField(index, 1)}
                              disabled={index === fields.length - 1}
                              className="term-chip rounded-full p-1.5 text-ink-soft hover:text-ink disabled:opacity-20"
                              aria-label="Move down"
                              title="Move down"
                            >
                              <ArrowDown size={13} />
                            </button>
                            {field.key !== 'title' ? (
                              <button
                                type="button"
                                onClick={() => removeField(index)}
                                className="term-chip rounded-full p-1.5 text-red-400 hover:text-red-300"
                                aria-label="Remove field"
                                title="Remove field"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Bottom row: Type selector & Required toggle */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <select
                            value={field.type}
                            onChange={(event) =>
                              updateField(index, { type: event.target.value as FieldType })
                            }
                            disabled={field.key === 'title'}
                            className="term-input rounded-none px-2 py-1 text-xs font-medium uppercase text-ink disabled:opacity-60"
                          >
                            {FIELD_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-soft cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(event) =>
                                updateField(index, { required: event.target.checked })
                              }
                              disabled={field.key === 'title'}
                              className="h-3.5 w-3.5 accent-ink"
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
                    className="border-ink/30 rounded-outline mt-2 flex items-center justify-center gap-1.5 border-2 border-dashed py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft hover:border-ink/60 hover:text-ink transition-colors"
                  >
                    <Plus size={14} /> Add new field
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="mt-3 flex items-center gap-2.5 border-t border-ink/15 pt-3">
              <button
                type="button"
                onClick={handleSave}
                className="term-btn-primary flex-1 rounded-full py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-widest"
              >
                Save category
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border-ink/30 rounded-outline border px-4 py-2.5 text-xs sm:text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
