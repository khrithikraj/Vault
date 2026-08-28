import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, Check, Pencil, Trash2, X } from 'lucide-react'
import { CategoryIcon } from '../lib/icons'
import type { Category, FieldDefinition, VaultItem } from '../types/app'

type ItemDetailOverlayProps = {
  item: VaultItem | null
  categories: Category[]
  category?: Category
  onClose: () => void
  onToggle: (item: VaultItem) => void
  onDelete: (itemId: string) => void
  onUpdate: (
    itemId: string,
    input: {
      title?: string
      notes?: string | null
      categoryId?: string
      metadata?: Record<string, unknown>
      imageFile?: File | null
      removeImage?: boolean
    },
  ) => Promise<void> | void
}

const prettyDateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function ItemDetailOverlay({
  item,
  categories,
  category,
  onClose,
  onToggle,
  onDelete,
  onUpdate,
}: ItemDetailOverlayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editMetadata, setEditMetadata] = useState<Record<string, string>>({})
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) {
      setIsEditing(false)
      setEditTitle(item.title)
      setEditNotes(item.notes ?? '')
      setEditCategoryId(item.category_id)
      setEditImageFile(null)
      setEditImagePreview(item.image_url)
      setRemoveExistingImage(false)

      const meta: Record<string, string> = {}
      if (item.metadata) {
        for (const [k, v] of Object.entries(item.metadata)) {
          meta[k] = v != null ? String(v) : ''
        }
      }
      setEditMetadata(meta)
    }
  }, [item])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const selectedCategory =
    categories.find((cat) => cat.id === (isEditing ? editCategoryId : item?.category_id)) ??
    category

  const currentCategoryFields: FieldDefinition[] = selectedCategory?.field_schema ?? []
  const metadataFields = currentCategoryFields.filter(
    (field) => field.key !== 'title' && field.key !== 'notes',
  )

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setEditImageFile(file)
    setRemoveExistingImage(false)
    setEditImagePreview(URL.createObjectURL(file))
  }

  const handleRemovePhoto = () => {
    setEditImageFile(null)
    setEditImagePreview(null)
    setRemoveExistingImage(true)
  }

  const handleSave = async () => {
    if (!item || !editTitle.trim()) return
    setSaving(true)
    try {
      const cleanMeta: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editMetadata)) {
        if (v?.trim()) {
          cleanMeta[k] = v.trim()
        }
      }

      await onUpdate(item.id, {
        title: editTitle.trim(),
        notes: editNotes.trim() || null,
        categoryId: editCategoryId,
        metadata: cleanMeta,
        imageFile: editImageFile,
        removeImage: removeExistingImage,
      })
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            layoutId={`item-card-${item.id}`}
            onClick={(event) => event.stopPropagation()}
            style={{ transformPerspective: 1200 }}
            className="term-panel term-brackets term-scrollbar relative max-h-screen md:max-h-[90vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded p-5 sm:p-7"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 26 }}
            >
              {/* Photo preview or Photo Editor */}
              {isEditing ? (
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  {editImagePreview ? (
                    <div className="relative overflow-hidden rounded border border-ink/20">
                      <img
                        src={editImagePreview}
                        alt=""
                        className="h-44 w-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-cloud/90 text-ink rounded-full px-3 py-1 text-xs font-semibold uppercase backdrop-blur-sm hover:bg-cloud"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="bg-red-950/80 text-red-300 rounded-full px-3 py-1 text-xs font-semibold uppercase backdrop-blur-sm hover:bg-red-900"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-ink/30 flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded border border-dashed text-ink-soft hover:border-ink/60 hover:text-ink transition-colors"
                    >
                      <Camera size={20} />
                      <span className="text-xs uppercase font-medium tracking-wide">Attach photo</span>
                    </button>
                  )}
                </div>
              ) : item.image_url ? (
                <div className="border-ink/20 relative -mx-5 -mt-5 sm:-mx-7 sm:-mt-7 mb-5 h-52 sm:h-56 w-[calc(100%+2.5rem)] sm:w-[calc(100%+3.5rem)] border-b overflow-hidden">
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      boxShadow:
                        'inset 0 1px 0 rgba(255,237,215,0.12), inset 0 -32px 48px -28px rgba(16,9,4,0.9)',
                    }}
                  />
                </div>
              ) : null}

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="grid gap-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                          Category
                        </label>
                        <select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          className="term-input mt-1 w-full rounded-none px-3 py-2 text-sm text-ink uppercase font-medium"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                          Title
                        </label>
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Item title"
                          required
                          className="term-input mt-1 w-full rounded-none px-3 py-2 text-base sm:text-lg font-bold text-ink"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedCategory ? (
                        <p className="text-micro mb-1.5 flex items-center gap-1.5 text-ink-soft">
                          <CategoryIcon
                            icon={selectedCategory.icon}
                            color={selectedCategory.color}
                            size={14}
                          />
                          {selectedCategory.name}
                        </p>
                      ) : null}
                      <h2 className="font-display text-xl sm:text-2xl font-semibold uppercase leading-tight text-ink">
                        {item.title}
                      </h2>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="term-chip flex items-center gap-1 rounded-full px-3 py-1.5 text-xs uppercase font-semibold text-ink hover:text-ink"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="term-chip rounded-full p-1.5 text-ink-soft hover:text-ink"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Dynamic Metadata Fields */}
              {isEditing ? (
                <div className="mt-4 grid gap-3 border-t border-ink/15 pt-3">
                  {metadataFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={editMetadata[field.key] ?? ''}
                          onChange={(e) =>
                            setEditMetadata((cur) => ({ ...cur, [field.key]: e.target.value }))
                          }
                          className="term-input mt-1 w-full rounded-none px-3 py-2 text-sm text-ink"
                        />
                      ) : (
                        <div className="relative mt-1">
                          {field.type === 'currency' && (
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                              ₹
                            </span>
                          )}
                          <input
                            type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                            value={editMetadata[field.key] ?? ''}
                            onChange={(e) =>
                              setEditMetadata((cur) => ({ ...cur, [field.key]: e.target.value }))
                            }
                            placeholder={field.placeholder || field.label}
                            className={`term-input w-full rounded-none py-2 text-sm text-ink ${
                              field.type === 'currency' ? 'pl-7 pr-3' : 'px-3'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add any extra details, remarks, or notes..."
                      className="term-input mt-1 w-full rounded-none px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {metadataFields.length > 0 ? (
                    <dl className="mt-4 grid gap-2.5">
                      {metadataFields
                        .filter((field) => item.metadata?.[field.key])
                        .map((field) => (
                          <div key={field.key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm">
                            <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                              {field.label}
                            </dt>
                            <dd className="break-words font-medium text-ink">
                              {field.type === 'currency' ? '₹' : ''}
                              {field.type === 'url' ? (() => {
                                const rawUrl = String(item.metadata[field.key])
                                // Only allow http/https — block javascript: and other dangerous schemes
                                const safeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
                                return (
                                  <a
                                    href={safeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent underline hover:opacity-80 break-all"
                                  >
                                    {rawUrl}
                                  </a>
                                )
                              })() : (
                                String(item.metadata[field.key])
                              )}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  ) : null}

                  {item.notes ? (
                    <div className="mt-4 rounded border border-dashed border-ink/20 p-3 bg-ink/5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">
                        Notes
                      </p>
                      <p className="text-sm leading-relaxed text-ink-soft whitespace-pre-wrap">
                        {item.notes}
                      </p>
                    </div>
                  ) : !metadataFields.some((f) => item.metadata?.[f.key]) ? (
                    <p className="mt-4 text-sm italic text-ink-soft/70">No extra details added.</p>
                  ) : null}

                  {/* Folio metadata row */}
                  <p className="folio mt-5 flex items-center justify-between border-t border-dashed border-ink/20 pt-3 text-xs text-ink-soft/70">
                    <span>Saved {prettyDateTime.format(new Date(item.created_at))}</span>
                    <span className="tracking-[0.2em] text-ink-soft/40">
                      #{item.id.slice(0, 4).toUpperCase()}
                    </span>
                  </p>
                </>
              )}

              {/* Bottom Buttons */}
              <div className="mt-5 flex flex-wrap gap-2 pt-1 border-t border-ink/15">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !editTitle.trim()}
                      className="term-btn-primary flex-1 rounded-full px-4 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Check size={14} /> {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="border-ink/30 rounded-outline border px-4 py-2.5 text-xs sm:text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggle(item)}
                      className={`term-btn-primary flex-1 rounded-full px-4 py-2.5 text-xs sm:text-sm font-medium uppercase tracking-wide ${
                        item.status === 'done' ? 'opacity-70' : ''
                      }`}
                    >
                      {item.status === 'done' ? 'Marked as done' : 'Mark as done'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(item.id)
                        onClose()
                      }}
                      className="border-ink/30 rounded-outline border px-4 py-2.5 text-xs sm:text-sm font-medium uppercase tracking-wide text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
