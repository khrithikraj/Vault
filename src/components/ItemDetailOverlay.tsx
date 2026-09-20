import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Copy, Pencil, Plus, Share2, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { CompletionControl } from './CompletionControl'
import { FieldQuickActions } from './FieldQuickActions'
import { StarRating } from './ui/StarRating'
import { VaultDialog } from './ui/VaultDialog'
import { ItemIdentitySection } from './item-detail/ItemIdentitySection'
import { ItemPhotoSection } from './item-detail/ItemPhotoSection'
import { ShareStatusPanel } from './ShareStatusPanel'
import type { MoreActionItem } from './ui/MoreActionsMenu'
import { VaultButton, VaultIconButton } from './ui/VaultButton'
import { VaultInput, VaultTextarea } from './ui/VaultInput'
import { createSharedItem } from '../lib/share'
import {
  getTriedEntries,
  internalMetadata,
  withTriedEntryAdded,
  withTriedEntryRemoved,
  INTERNAL_METADATA_KEYS,
} from '../lib/ratings'
import type { Category, FieldDefinition, VaultItem } from '../types/app'
import { FoodSpotBranches } from './item-detail/FoodSpotBranches'

/** Editorial metadata date — DD MMM (18 SEP), matching the Notes metadata line. */
const META_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatMetaDate(iso: string): string {
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, '0')
  return `${day} ${META_MONTHS[date.getMonth()]}`
}

type ItemDetailOverlayProps = {
  item: VaultItem | null
  categories: Category[]
  category?: Category
  onClose: () => void
  onToggle: (item: VaultItem) => void
  onDelete: (itemId: string) => Promise<boolean> | boolean
  onToggleFavorite: (item: VaultItem) => void
  onUpdate: (
    itemId: string,
    input: {
      title?: string
      notes?: string | null
      categoryId?: string
      metadata?: Record<string, unknown>
      is_favorite?: boolean
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
  onToggleFavorite,
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
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'done' | 'error'>('idle')
  const [shareUrl, setShareUrl] = useState('')
  const [shareError, setShareError] = useState('')
  const [triedName, setTriedName] = useState('')
  const [triedRating, setTriedRating] = useState(0)
  const [addingTried, setAddingTried] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (!item || shareState === 'sharing') return
    setShareState('sharing')
    setShareError('')
    try {
      const { url } = await createSharedItem(item, selectedCategory)
      setShareUrl(url)
      // Prefer the native share sheet when available; fall back to copying the link.
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: item.title, text: `Check this out on Raj's Vault`, url })
          setShareState('idle')
          return
        } catch {
          // User cancelled the sheet — leave the copy panel open.
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      }
      setShareState('done')
      window.setTimeout(() => setShareState('idle'), 3000)
    } catch (err) {
      setShareState('error')
      setShareUrl('')
      setShareError(err instanceof Error ? err.message : 'Unknown error.')
    }
  }

  const handleCopyItem = async () => {
    if (!item || copied) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.title)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = item.title
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
        } finally {
          document.body.removeChild(textarea)
        }
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — stay quiet.
    }
  }

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
          // Favorite flag + tried-entries are internal (non-schema) metadata —
          // never surface them in the generic per-category field editor.
          if ((INTERNAL_METADATA_KEYS as readonly string[]).includes(k)) continue
          meta[k] = v != null ? String(v) : ''
        }
      }
      setEditMetadata(meta)
      setTriedName('')
      setTriedRating(0)
      setAddingTried(false)
      setDeleteConfirmOpen(false)
      setDeleting(false)
      setCopied(false)
    }
  }, [item])

  const selectedCategory =
    categories.find((cat) => cat.id === (isEditing ? editCategoryId : item?.category_id)) ??
    category

  const currentCategoryFields: FieldDefinition[] = selectedCategory?.field_schema ?? []
  const metadataFields = currentCategoryFields.filter(
    (field) => field.key !== 'title' && field.key !== 'notes',
  )

  const handlePhotoSelect = (file: File) => {
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
        // Re-merge the internal favorite/tried-entries metadata so a generic
        // field edit never clobbers them (they're excluded from editMetadata).
        metadata: { ...cleanMeta, ...internalMetadata(item) },
        imageFile: editImageFile,
        removeImage: removeExistingImage,
      })
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTried = async () => {
    if (!item || !triedName.trim() || triedRating < 1) return
    setAddingTried(true)
    try {
      await onUpdate(item.id, { metadata: withTriedEntryAdded(item, { name: triedName, rating: triedRating }) })
      setTriedName('')
      setTriedRating(0)
    } finally {
      setAddingTried(false)
    }
  }

  const handleRemoveTried = async (entryId: string) => {
    if (!item) return
    await onUpdate(item.id, { metadata: withTriedEntryRemoved(item, entryId) })
  }

  const handleDelete = async () => {
    if (!item || deleting) return
    setDeleting(true)
    const deleted = await onDelete(item.id)
    setDeleting(false)
    if (deleted) {
      setDeleteConfirmOpen(false)
      onClose()
    }
  }

  const moreItems: MoreActionItem[] = [
    { id: 'edit', label: 'Edit', icon: Pencil, onSelect: () => setIsEditing(true) },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      disabled: shareState === 'sharing',
      onSelect: () => void handleShare(),
    },
    {
      id: 'copy',
      label: copied ? 'Copied' : 'Copy',
      icon: copied ? Check : Copy,
      onSelect: () => void handleCopyItem(),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      divider: true,
      onSelect: () => setDeleteConfirmOpen(true),
    },
  ]

  return (
    <>
      <VaultDialog
        open={item !== null}
        onClose={onClose}
        title="Item details"
        showClose
        closeLabel="Close item details"
        className="max-w-lg"
        bodyClassName="vault-scrollbar max-h-[calc(100dvh-8rem)] overflow-y-auto overflow-x-hidden p-5 sm:p-7"
      >
        {item ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 26 }}
            >
              <ItemPhotoSection
                title={editTitle || item.title}
                editing={isEditing}
                imageUrl={isEditing ? editImagePreview : item.image_url}
                onSelect={handlePhotoSelect}
                onRemove={handleRemovePhoto}
              />

              <ItemIdentitySection
                item={item}
                categories={categories}
                category={selectedCategory}
                editing={isEditing}
                title={editTitle}
                categoryId={editCategoryId}
                metaDate={formatMetaDate(item.created_at)}
                onTitleChange={setEditTitle}
                onCategoryChange={setEditCategoryId}
                onToggleFavorite={() => onToggleFavorite(item)}
                moreItems={moreItems}
              />

              {!isEditing ? (
                <ShareStatusPanel
                  state={shareState}
                  url={shareUrl}
                  error={shareError}
                  onCopy={() => {
                    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(shareUrl)
                    setShareState('done')
                    window.setTimeout(() => setShareState('idle'), 3000)
                  }}
                />
              ) : null}

              {/* Dynamic Metadata Fields */}
              {isEditing ? (
                <section aria-labelledby="item-fields-heading" className="mt-4 grid gap-3 border-t border-ink/15 pt-3">
                  <h3 id="item-fields-heading" className="vault-meta text-ink-soft/55">Filed details</h3>
                  {metadataFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      {field.type === 'textarea' ? (
                        <VaultTextarea
                          rows={3}
                          value={editMetadata[field.key] ?? ''}
                          onChange={(e) =>
                            setEditMetadata((cur) => ({ ...cur, [field.key]: e.target.value }))
                          }
                          className="mt-1 rounded-none"
                        />
                      ) : (
                        <div className="relative mt-1">
                          {field.type === 'currency' && (
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                              ₹
                            </span>
                          )}
                          <VaultInput
                            type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                            value={editMetadata[field.key] ?? ''}
                            onChange={(e) =>
                              setEditMetadata((cur) => ({ ...cur, [field.key]: e.target.value }))
                            }
                            placeholder={field.placeholder || field.label}
                            className={`rounded-none py-2 ${
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
                    <VaultTextarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add any extra details, remarks, or notes..."
                      className="mt-1 rounded-none"
                    />
                  </div>
                </section>
              ) : (
                <>
                  {metadataFields.length > 0 ? (
                    <section aria-labelledby="item-fields-heading" className="mt-4">
                      <h3 id="item-fields-heading" className="vault-meta mb-3 text-ink-soft/55">Filed details</h3>
                      <dl className="grid gap-3">
                      {metadataFields
                        .filter((field) => String(item.metadata?.[field.key] ?? '').length > 0)
                        .map((field) => (
                          <div key={field.key} className="flex flex-col gap-1 text-sm">
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
                            <FieldQuickActions
                              value={String(item.metadata[field.key] ?? '')}
                              fieldType={field.type}
                              label={field.label}
                            />
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}

                  {item.notes ? (
                    <section aria-labelledby="item-notes-heading" className="mt-4 border border-dashed border-ink/20 bg-ink/5 p-3">
                      <h3 id="item-notes-heading" className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">
                        Notes
                      </h3>
                      <p className="text-sm leading-relaxed text-ink-soft whitespace-pre-wrap">
                        {item.notes}
                      </p>
                    </section>
                  ) : !metadataFields.some((f) => item.metadata?.[f.key]) ? (
                    <p className="mt-4 text-sm italic text-ink-soft/70">No extra details added.</p>
                  ) : null}

                  {selectedCategory?.name === 'Food Spots' ? (
                    <FoodSpotBranches
                      key={item.id}
                      item={item}
                      onUpdate={(metadata) => onUpdate(item.id, { metadata })}
                    />
                  ) : null}

                  {/* Tried entries + ratings — e.g. multiple dishes tried at one food spot */}
                  {item.status === 'done' ? (
                    <section aria-labelledby="item-tried-heading" className="mt-4 border border-dashed border-ink/20 p-3">
                      <h3 id="item-tried-heading" className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-2">
                        Tried
                      </h3>
                      {getTriedEntries(item).length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {getTriedEntries(item).map((entry) => (
                            <li
                              key={entry.id}
                              className="flex items-center justify-between gap-2 rounded bg-ink/5 px-2.5 py-1.5"
                            >
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                                {entry.name}
                              </span>
                              <StarRating value={entry.rating} size={13} />
                              <VaultIconButton
                                onClick={() => void handleRemoveTried(entry.id)}
                                icon={X}
                                size={13}
                                label={`Remove ${entry.name}`}
                                variant="danger"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm italic text-ink-soft/70">Nothing logged yet.</p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <VaultInput
                          value={triedName}
                          onChange={(e) => setTriedName(e.target.value)}
                          placeholder="What did you try?"
                          className="min-w-0 flex-1 rounded-none py-1.5"
                        />
                        <StarRating value={triedRating} onChange={setTriedRating} size={15} />
                        <VaultButton
                          type="button"
                          onClick={() => void handleAddTried()}
                          disabled={addingTried || !triedName.trim() || triedRating < 1}
                          variant="chip"
                          size="sm"
                          icon={Plus}
                          className="shrink-0 uppercase disabled:opacity-40"
                        >
                          Add
                        </VaultButton>
                      </div>
                    </section>
                  ) : null}

                  {/* Folio metadata row */}
                  <p className="folio mt-5 flex items-center justify-between border-t border-dashed border-ink/20 pt-3 text-xs text-ink-soft/70">
                    <span>Saved {prettyDateTime.format(new Date(item.created_at))}</span>
                  </p>
                </>
              )}

              {/* Bottom Buttons */}
              <div className="mt-5 border-t border-ink/15 pt-1">
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !editTitle.trim()}
                      className="vault-btn-solid flex-1 rounded-full px-4 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <CompletionControl
                      done={item.status === 'done'}
                      actionLabel={`Mark ${item.title} as done`}
                      doneLabel={`Mark ${item.title} as saved`}
                      onToggle={() => onToggle(item)}
                    />
                  </div>
                )}
              </div>
            </motion.div>
        ) : null}
      </VaultDialog>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Move to trash?"
        message={item ? (
          <>
            <span className="font-semibold text-ink">{item.title}</span> will be moved to Trash and can be restored.
          </>
        ) : null}
        confirmLabel="Move to trash"
        busy={deleting}
        busyLabel="Moving…"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  )
}
