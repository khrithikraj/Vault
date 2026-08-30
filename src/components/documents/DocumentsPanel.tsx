/**
 * DocumentsPanel — the main Documents section.
 *
 * Structure mirrors NotesPanel exactly:
 *   - Header with section title + "Add Document" button (opens the uploader lifted to App)
 *   - Category filter pills
 *   - Grid of DocumentCard components
 *   - Empty state matching Vault's dashed-border aesthetic
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { FolderLock, Plus } from 'lucide-react'
import { BrandIcon } from '../../lib/icons'
import { DocumentCard } from './DocumentCard'
import { DocumentDeleteDialog } from './DocumentDeleteDialog'
import { DOCUMENT_CATEGORIES } from '../../types/app'
import type { DocumentCategory, VaultDocument } from '../../types/app'

type DocumentsPanelProps = {
  documents: VaultDocument[]
  loading: boolean
  message: string
  onOpenDoc: (doc: VaultDocument) => void
  /** Opens the app-level DocumentUploader (lifted so Quick Add can open it from anywhere). */
  onOpenUploader: () => void
  onDelete: (doc: VaultDocument) => Promise<boolean>
  onDismissMessage: () => void
}

export function DocumentsPanel({
  documents,
  loading,
  message,
  onOpenDoc,
  onOpenUploader,
  onDelete,
  onDismissMessage,
}: DocumentsPanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<VaultDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | 'All'>('All')

  const filteredDocs = filterCategory === 'All'
    ? documents
    : documents.filter((d) => d.category === filterCategory)

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const success = await onDelete(deleteTarget)
    setDeleting(false)
    if (success) {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="mt-4">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-ink sm:text-lg">
          <BrandIcon icon={FolderLock} size={20} />
          Documents
        </h2>
        <button
          type="button"
          onClick={onOpenUploader}
          className="term-btn-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm"
        >
          <Plus size={15} /> Add Document
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Message banner                                                        */}
      {/* ------------------------------------------------------------------ */}
      {message && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded border border-dashed border-ink/30 bg-transparent p-4 text-sm text-ink">
          <p>{message}</p>
          <button
            type="button"
            onClick={onDismissMessage}
            className="term-chip shrink-0 rounded-full px-2 py-1 text-xs font-medium uppercase tracking-wide"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Category filter pills                                                 */}
      {/* ------------------------------------------------------------------ */}
      {documents.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(['All', ...DOCUMENT_CATEGORIES] as const).map((cat) => {
            const count = cat === 'All'
              ? documents.length
              : documents.filter((d) => d.category === cat).length
            if (cat !== 'All' && count === 0) return null
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                data-active={filterCategory === cat ? 'true' : undefined}
                className="term-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all"
              >
                {cat}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                               */}
      {/* ------------------------------------------------------------------ */}
      {loading && documents.length === 0 ? (
        /* Skeleton state */
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="term-panel h-28 animate-pulse rounded" />
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="term-panel-soft border-ink/30 rounded border-dashed p-10 text-center"
        >
          {filterCategory !== 'All' ? (
            <>
              <p className="text-sm text-ink-soft">No {filterCategory} documents yet.</p>
              <button
                type="button"
                onClick={() => setFilterCategory('All')}
                className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent underline"
              >
                Show all
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              No documents yet — tap &ldquo;Add Document&rdquo; to upload one.
            </p>
          )}
        </motion.div>
      ) : (
        /* Document grid */
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc, index) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              index={index}
              onClick={() => onOpenDoc(doc)}
              onDelete={() => setDeleteTarget(doc)}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals / Overlays                                                     */}
      {/* ------------------------------------------------------------------ */}
      <DocumentDeleteDialog
        doc={deleteTarget}
        deleting={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
