/**
 * DocumentViewer — secure in-app document preview overlay.
 *
 * SECURITY:
 *   - Fetches a short-lived signed URL (60 s) from Supabase on every open.
 *   - Never stores the signed URL in persistent state (cleared on close).
 *   - Never calls getPublicUrl() — the bucket is private.
 *   - Download fetches a fresh signed URL (60 s) at click time, converts to a
 *     Blob URL client-side, triggers the browser's native download, then
 *     immediately revokes the object URL.
 *
 * PDF RENDERING:
 *   - Rendered page-by-page to `<canvas>` via pdfjs-dist (see PdfCanvasViewer),
 *     continuous vertical scroll. Avoids the native `<object>`/`<iframe>` embed,
 *     which many mobile browsers refuse to render inline.
 *
 * BACK NAVIGATION:
 *   - Managed via App-level unified overlay history architecture in App.tsx.
 *   - Closing via X / backdrop / Escape triggers unified history pop/dismiss.
 *
 * LAYOUT:
 *   - Uses the shared `VaultDialog` sheet contract at `100dvh`.
 *   - The preview content owns scrolling below the fixed title and action regions.
 */

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Image, AlertTriangle, Loader2, Trash2, Pencil } from 'lucide-react'
import { getSignedUrl } from '../../lib/documents'
import { CopyButton } from '../CopyButton'
import { ConfirmDialog } from '../ConfirmDialog'
import { VaultButton } from '../ui/VaultButton'
import { VaultDialog } from '../ui/VaultDialog'
import { DocumentEditDialog } from './DocumentEditDialog'
import { PdfCanvasViewer } from './PdfCanvasViewer'
import type { DocumentCategory, VaultDocument } from '../../types/app'

type DocumentViewerProps = {
  doc: VaultDocument | null
  onClose: () => void
  onDelete: (doc: VaultDocument) => Promise<boolean>
  /** Persist metadata edits (name + category) — resolves only after Supabase confirms. */
  onUpdate: (
    doc: VaultDocument,
    name: string,
    category: DocumentCategory,
  ) => Promise<{ ok: boolean; error?: string }>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentViewer({ doc, onClose, onDelete, onUpdate }: DocumentViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const prevDocId = useRef<string | null>(null)

  // Reset the delete/edit flows when the viewer re-opens / switches document.
  useEffect(() => {
    setDeleteConfirmOpen(false)
    setDeleting(false)
    setEditOpen(false)
  }, [doc?.id])

  const handleDeleteConfirm = async () => {
    if (!doc || deleting) return
    setDeleting(true)
    const ok = await onDelete(doc)
    setDeleting(false)
    if (ok) {
      setDeleteConfirmOpen(false)
      onClose()
    }
  }

  const handleEditSave = async (name: string, category: DocumentCategory) => {
    if (!doc) return { ok: false as const, error: 'Document not found.' }
    return onUpdate(doc, name, category)
  }

  // ---------------------------------------------------------------------------
  // Fetch signed URL when the viewer opens (or doc changes).
  // URL is intentionally NOT pre-fetched from the list view — only on open.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!doc) {
      // Clear on close so no stale URL lingers in component state.
      setSignedUrl(null)
      setUrlError(null)
      setDownloadError(null)
      prevDocId.current = null
      return
    }

    // Skip re-fetching if same document is already loaded.
    if (prevDocId.current === doc.id && signedUrl) return
    prevDocId.current = doc.id

    let cancelled = false
    setLoadingUrl(true)
    setUrlError(null)
    setSignedUrl(null)
    setDownloadError(null)

    getSignedUrl(doc.storage_path, 60)
      .then((url) => {
        if (!cancelled) {
          setSignedUrl(url)
          setLoadingUrl(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setUrlError(err instanceof Error ? err.message : 'Could not load document.')
          setLoadingUrl(false)
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.storage_path])

  // ---------------------------------------------------------------------------
  // Download: fresh 60-second signed URL → fetch blob → trigger download.
  // Signed URL is never logged; object URL revoked immediately after trigger.
  // ---------------------------------------------------------------------------
  const handleDownload = async () => {
    if (!doc) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const url = await getSignedUrl(doc.storage_path, 60)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Download failed (${response.status})`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const anchor = document.createElement('a')
      anchor.href = objectUrl

      // Determine correct extension based on MIME type
      const ext = doc.mime_type === 'application/pdf' ? '.pdf'
        : doc.mime_type === 'image/jpeg' ? '.jpg'
        : doc.mime_type === 'image/png' ? '.png'
        : doc.mime_type === 'image/webp' ? '.webp'
        : ''

      // Sanitize the document name for download
      const safeBaseName = doc.name
        .replace(/[/\\?%*:|"<>]/g, '_')
        .trim()
        .replace(/_+/g, '_') || 'document'

      const finalFilename = safeBaseName.toLowerCase().endsWith(ext)
        ? safeBaseName
        : `${safeBaseName}${ext}`

      anchor.download = finalFilename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      // Revoke immediately after click
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }

  const isPdf = doc?.mime_type === 'application/pdf'
  const isImage = doc?.mime_type.startsWith('image/')

  return (
    <>
      <VaultDialog
        open={doc !== null}
        onClose={onClose}
        title={doc?.name}
        showClose
        closeLabel="Close viewer"
        variant="sheet"
        backdropOpacity={0.8}
        className="my-0 h-[100dvh] max-w-3xl !p-0 sm:my-auto sm:!p-4"
        surfaceClassName="flex h-full flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        {doc ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* ----------------------------------------------------------------
                Header — fixed height, always visible
            ---------------------------------------------------------------- */}
            <div className="flex shrink-0 items-center gap-3 border-b border-ink/15 px-4 py-3 sm:px-6">
              {/* File type indicator */}
              {isPdf
                ? <FileText size={18} className="shrink-0 text-accent" style={{ filter: 'drop-shadow(0 0 5px rgba(220,80,0,0.5))' }} aria-hidden="true" />
                : <Image size={18} className="shrink-0 text-warn" style={{ filter: 'drop-shadow(0 0 5px rgba(242,177,52,0.5))' }} aria-hidden="true" />
              }

              {/* Metadata */}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-ink-soft uppercase tracking-widest">
                  {doc.category} · {formatBytes(doc.file_size)}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-2">
                <CopyButton text={doc.name} label="Copy" copiedLabel="Copied" />
                <VaultButton
                  type="button"
                  onClick={() => setEditOpen(true)}
                  variant="chip"
                  size="sm"
                  icon={Pencil}
                  className="uppercase tracking-wide text-ink-soft hover:text-ink"
                  aria-label="Edit document"
                  title="Edit document"
                >
                  <span className="hidden sm:inline">Edit</span>
                </VaultButton>
                <VaultButton
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  className="uppercase tracking-wide"
                  aria-label="Delete document"
                  title="Delete document"
                >
                  <span className="hidden sm:inline">Delete</span>
                </VaultButton>
                <VaultButton
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  variant="solid"
                  size="sm"
                  icon={downloading ? Loader2 : Download}
                  className={`uppercase tracking-wide disabled:opacity-50 ${downloading ? '[&>svg]:animate-spin' : ''}`}
                  aria-label="Download document"
                >
                  <span className="hidden sm:inline">{downloading ? 'Downloading…' : 'Download'}</span>
                </VaultButton>
              </div>
            </div>

            {/* ----------------------------------------------------------------
                Download error banner (below header, above content)
            ---------------------------------------------------------------- */}
            {downloadError && (
              <div className="flex shrink-0 items-center gap-2 border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-400">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{downloadError}</span>
                <button
                  type="button"
                  onClick={() => setDownloadError(null)}
                  className="ml-auto shrink-0 underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ----------------------------------------------------------------
                Content area — fills remaining height, scrollable
            ---------------------------------------------------------------- */}
            <div className="vault-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {/* Loading state */}
              {loadingUrl && (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-ink-soft">
                  <Loader2 size={28} className="animate-spin text-accent" />
                  <p className="text-sm uppercase tracking-widest">Loading…</p>
                </div>
              )}

              {/* Error state */}
              {urlError && !loadingUrl && (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-8 text-center text-ink-soft">
                  <AlertTriangle size={28} className="text-red-400" />
                  <p className="text-sm">{urlError}</p>
                  <VaultButton
                    type="button"
                    onClick={() => {
                      prevDocId.current = null
                      setSignedUrl(null)
                      setUrlError(null)
                    }}
                    variant="solid"
                    size="sm"
                    className="mt-2 uppercase"
                  >
                    Retry
                  </VaultButton>
                </div>
              )}

              {/* PDF — rendered to canvas via pdfjs-dist, continuous vertical scroll.
                  Works identically on every browser/platform, including mobile
                  Safari/WebViews that refuse inline <object>/<iframe> PDF embeds. */}
              {!loadingUrl && !urlError && signedUrl && isPdf && (
                <PdfCanvasViewer url={signedUrl} fileName={doc.name} />
              )}

              {/* Image preview */}
              {!loadingUrl && !urlError && signedUrl && isImage && (
                <div className="flex min-h-[200px] items-center justify-center p-2 sm:p-4">
                  <img
                    src={signedUrl}
                    alt={doc.name}
                    className="max-h-full max-w-full rounded object-contain"
                    style={{ maxHeight: 'calc(100dvh - 80px)' }}
                    draggable={false}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </VaultDialog>

      {doc ? (
        <>
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Move to trash?"
          message={
            <>
              <span className="font-semibold text-ink">{doc.name}</span> will be moved to Trash.
              The file stays private and can be restored.
            </>
          }
          confirmLabel="Move to trash"
          busy={deleting}
          busyLabel="Moving…"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmOpen(false)}
        />

        <DocumentEditDialog
          doc={editOpen ? doc : null}
          onSave={handleEditSave}
          onCancel={() => setEditOpen(false)}
        />
        </>
      ) : null}
    </>
  )
}
