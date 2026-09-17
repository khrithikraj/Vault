/**
 * DocumentsPanel — the main Documents section.
 *
 * Structure mirrors NotesPanel exactly:
 *   - Header with section title + "Add Document" button (opens the uploader lifted to App)
 *   - Category filter pills
 *   - Grid of DocumentCard components
 *   - Empty state matching Vault's dashed-border aesthetic
 */

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { DocumentCard } from './DocumentCard'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortMenu } from '../ui/SortMenu'
import { VaultEmptyState } from '../ui/VaultEmptyState'
import { VaultSection } from '../ui/VaultSection'
import { VaultSkeleton } from '../ui/VaultSkeleton'
import { sortDocuments, DOCUMENT_SORT_OPTIONS } from '../../lib/sort'
import type { DocumentSortKey } from '../../lib/sort'
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
  onToggleFavorite: (doc: VaultDocument) => void
}

export function DocumentsPanel({
  documents,
  loading,
  message,
  onOpenDoc,
  onOpenUploader,
  onDelete,
  onDismissMessage,
  onToggleFavorite,
}: DocumentsPanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<VaultDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | 'All'>('All')
  const [sortKey, setSortKey] = useState<DocumentSortKey>(() => {
    if (typeof window === 'undefined') return 'newest'
    return (window.localStorage.getItem('vault:docSort') as DocumentSortKey | null) ?? 'newest'
  })
  useEffect(() => {
    window.localStorage.setItem('vault:docSort', sortKey)
  }, [sortKey])

  const filteredDocs = sortDocuments(
    filterCategory === 'All' ? documents : documents.filter((d) => d.category === filterCategory),
    sortKey,
  )

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
    <VaultSection
      className="mt-10"
      label="Documents"
      folio="01"
      title="Documents"
      right={
        <div className="flex items-center gap-2">
          <SortMenu value={sortKey} options={DOCUMENT_SORT_OPTIONS} onChange={setSortKey} />
          <button
            type="button"
            onClick={onOpenUploader}
            className="vault-btn-solid flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm"
          >
            <Plus size={15} /> Add Document
          </button>
        </div>
      }
    >

      {/* ------------------------------------------------------------------ */}
      {/* Message banner                                                        */}
      {/* ------------------------------------------------------------------ */}
      {message && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded border border-dashed border-ink/30 bg-transparent p-4 text-sm text-ink">
          <p>{message}</p>
          <button
            type="button"
            onClick={onDismissMessage}
            className="vault-chip shrink-0 rounded-full px-2 py-1 text-xs font-medium uppercase tracking-wide"
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
                className="vault-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all"
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
            <VaultSkeleton key={key} className="h-28" />
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <VaultEmptyState
          title={filterCategory !== 'All' ? `No ${filterCategory} documents` : 'No documents yet'}
          description={filterCategory === 'All' ? 'Add a document to keep it available here.' : undefined}
          action={filterCategory !== 'All' ? (
            <button
              type="button"
              onClick={() => setFilterCategory('All')}
              className="text-xs font-semibold uppercase tracking-wide text-accent underline"
            >
              Show all
            </button>
          ) : undefined}
        />
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
              onToggleFavorite={() => onToggleFavorite(doc)}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals / Overlays                                                     */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Move to trash?"
        message={deleteTarget ? (
          <>
            <span className="font-semibold text-ink">{deleteTarget.name}</span> will be moved to
            Trash. The file stays private and can be restored.
          </>
        ) : null}
        confirmLabel="Move to trash"
        busy={deleting}
        busyLabel="Moving…"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </VaultSection>
  )
}
