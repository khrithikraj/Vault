import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, Plus, Trash2, Sliders, Palette, Check } from 'lucide-react'
import { FIELD_TYPE_OPTIONS, makeFieldKey } from '../lib/fields'
import { CategoryIcon } from '../lib/icons'
import { VaultSelect } from './VaultSelect'
import { VaultButton } from './ui/VaultButton'
import { VaultDialog } from './ui/VaultDialog'
import { VaultInput } from './ui/VaultInput'
import { ConfirmDialog } from './ConfirmDialog'
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
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [pendingFieldChange, setPendingFieldChange] = useState<
    | { kind: 'remove'; index: number }
    | { kind: 'type'; index: number; type: FieldType }
    | null
  >(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const initialStateRef = useRef('')

  const stateSignature = useMemo(
    () => JSON.stringify({ name: name.trim(), icon: icon.trim(), color, fields }),
    [color, fields, icon, name],
  )
  const dirty = category !== null && stateSignature !== initialStateRef.current

  useEffect(() => {
    if (category) {
      setName(category.name)
      setIcon(category.icon || '✨')
      setColor(category.color || '#dbe9ff')
      setFields(category.field_schema.length > 0 ? category.field_schema : [])
      setActiveTab('general')
      initialStateRef.current = JSON.stringify({
        name: category.name.trim(),
        icon: (category.icon || '✨').trim(),
        color: category.color || '#dbe9ff',
        fields: category.field_schema.length > 0 ? category.field_schema : [],
      })
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

  const requestRemoveField = (index: number) => {
    setPendingFieldChange({ kind: 'remove', index })
  }

  const requestTypeChange = (index: number, type: FieldType) => {
    if (fields[index].type === type) return
    setPendingFieldChange({ kind: 'type', index, type })
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

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  const confirmFieldChange = () => {
    if (!pendingFieldChange) return
    if (pendingFieldChange.kind === 'remove') removeField(pendingFieldChange.index)
    else updateField(pendingFieldChange.index, { type: pendingFieldChange.type })
    setPendingFieldChange(null)
  }

  return (
    <VaultDialog
      open={category !== null}
      onClose={requestClose}
      title="Edit category"
      showClose
      closeLabel="Cancel category changes"
      className="max-w-lg"
      bodyClassName="vault-scrollbar max-h-[calc(100dvh-8rem)] overflow-y-auto overflow-x-hidden"
      initialFocusRef={nameInputRef}
      footer={
        <>
          <VaultButton type="button" variant="solid" size="md" onClick={handleSave} className="flex-1">
            Save category
          </VaultButton>
          <VaultButton type="button" variant="ghost" size="md" onClick={requestClose}>
            Cancel
          </VaultButton>
        </>
      }
    >
      {category ? (
        <>
            <div className="flex items-center gap-2.5 min-w-0 border-b border-ink/15 pb-4">
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

            {/* Tabs */}
            <div className="mt-3 flex gap-2 border-b border-ink/10 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                aria-pressed={activeTab === 'general'}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  activeTab === 'general'
                    ? 'vault-btn-solid'
                    : 'border border-ink/20 text-ink-soft hover:text-ink'
                }`}
              >
                <Palette size={13} /> Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fields')}
                aria-pressed={activeTab === 'fields'}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  activeTab === 'fields'
                    ? 'vault-btn-solid'
                    : 'border border-ink/20 text-ink-soft hover:text-ink'
                }`}
              >
                <Sliders size={13} /> Fields ({fields.length})
              </button>
            </div>

            {/* Content area with smooth scrolling */}
            <div className="vault-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-4 pr-1">
              {activeTab === 'general' ? (
                <div className="grid gap-4">
                  {/* Category Name */}
                  <div>
                    <label htmlFor="category-name" className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                      Category name
                    </label>
                    <VaultInput
                      ref={nameInputRef}
                      id="category-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Passwords, Receipts, Ideas"
                      className="mt-1.5 rounded-none text-base font-medium"
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
                        className="vault-input h-10 w-14 rounded-none px-2 text-center text-lg text-ink"
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
                <div className="grid w-full max-w-full gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-soft">
                      Define the custom fields captured when adding items to this category.
                    </p>
                  </div>

                  <div className="grid w-full max-w-full min-w-0 gap-2.5">
                    {fields.map((field, index) => (
                      <motion.div
                        layout
                        key={`${field.key}-${index}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        onKeyDown={(event) => {
                          if (!event.altKey) return
                          if (event.key === 'ArrowUp' && index > 0) {
                            event.preventDefault()
                            moveField(index, -1)
                          } else if (event.key === 'ArrowDown' && index < fields.length - 1) {
                            event.preventDefault()
                            moveField(index, 1)
                          }
                        }}
                        className="vault-surface-soft grid w-full max-w-full min-w-0 gap-2 rounded border border-ink/15 p-3"
                      >
                        {/* Top row: Label & order controls */}
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            value={field.label}
                            onChange={(event) => updateField(index, { label: event.target.value })}
                            placeholder="Field label (e.g. Website, Price, Username)"
                            disabled={field.key === 'title'}
                            className="vault-input min-w-0 flex-1 rounded-none px-2.5 py-1.5 text-sm disabled:opacity-60"
                          />
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveField(index, -1)}
                              disabled={index === 0}
                              className="vault-chip rounded-full p-1.5 text-ink-soft hover:text-ink disabled:opacity-20"
                              aria-label="Move up"
                              title="Move up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveField(index, 1)}
                              disabled={index === fields.length - 1}
                              className="vault-chip rounded-full p-1.5 text-ink-soft hover:text-ink disabled:opacity-20"
                              aria-label="Move down"
                              title="Move down"
                            >
                              <ArrowDown size={13} />
                            </button>
                            {field.key !== 'title' ? (
                              <button
                                type="button"
                                onClick={() => requestRemoveField(index)}
                                className="vault-chip rounded-full p-1.5 text-red-400 hover:text-red-300"
                                aria-label="Remove field"
                                title="Remove field"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Bottom row: Type selector & Required toggle */}
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <div className="w-full max-w-40">
                            <VaultSelect<FieldType>
                              options={FIELD_TYPE_OPTIONS}
                              value={field.type}
                              onSelect={(type) => requestTypeChange(index, type)}
                              disabled={field.key === 'title'}
                              up
                              ariaLabel={`Field type for ${field.label || 'field'}`}
                            />
                          </div>
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

                  <div className="mt-2 border-t border-ink/10 pt-4" aria-live="polite">
                    <p className="vault-meta text-[var(--accession-text-muted)]">Capture preview</p>
                    <div className="mt-2 grid gap-2">
                      {fields.map((field, index) => (
                        <div key={`preview-${field.key}-${index}`} className="flex items-center justify-between gap-4 border-b border-ink/[0.07] py-2">
                          <span className="min-w-0 break-words text-sm text-ink">{field.label.trim() || 'Untitled field'}</span>
                          <span className="shrink-0 text-xs text-ink-soft">
                            {FIELD_TYPE_OPTIONS.find((option) => option.value === field.type)?.label}
                            {field.required ? ' · Required' : ' · Optional'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-ink-soft/70">Use Alt+Arrow Up or Alt+Arrow Down while focused in a field to reorder it.</p>
                  </div>
                </div>
              )}
            </div>

        </>
      ) : null}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard category changes?"
        message="Your unsaved category and field changes will be lost."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      <ConfirmDialog
        open={pendingFieldChange !== null}
        title={pendingFieldChange?.kind === 'remove' ? 'Remove this field?' : 'Change field type?'}
        message={
          pendingFieldChange?.kind === 'remove'
            ? 'Existing values stored under this field will no longer appear in the category form. This cannot be inferred or reversed after saving.'
            : 'Existing values may not match the new field type. Review affected items after saving.'
        }
        confirmLabel={pendingFieldChange?.kind === 'remove' ? 'Remove field' : 'Change type'}
        onConfirm={confirmFieldChange}
        onCancel={() => setPendingFieldChange(null)}
      />
    </VaultDialog>
  )
}
