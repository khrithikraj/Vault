/**
 * DocumentUploader — overlay for adding a new document.
 *
 * Follows the same fixed-inset overlay pattern as ItemDetailOverlay but
 * simpler (two fields + file picker). Matches CaptureFab's visual language.
 *
 * Validation:
 *   - MIME type checked client-side (matches server-side policy)
 *   - File size checked client-side (matches 25 MB server limit)
 *   - Name required and trimmed before submit
 *   - Category required (no blank option)
 *
 * Upload succeeds → onUploaded() is called → parent closes the overlay
 * and prepends the new document to the list.
 */

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Upload, X, FolderOpen, FileText, Image, Loader2, AlertTriangle, Minimize2 } from 'lucide-react'
import { validateDocumentFile, MAX_DOC_BYTES, ALLOWED_MIME_TYPES } from '../../lib/documents'
import { VaultSelect } from '../VaultSelect'
import { compressImage, shouldOfferOptimize } from '../../lib/compressImage'
import { DOCUMENT_CATEGORIES } from '../../types/app'
import type { DocumentCategory } from '../../types/app'

type DocumentUploaderProps = {
  open: boolean
  uploading: boolean
  onClose: () => void
  onUpload: (file: File, name: string, category: DocumentCategory) => Promise<void>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FilePill({ file, onClear }: { file: File; onClear: () => void }) {
  const isPdf = file.type === 'application/pdf'
  return (
    <div className="flex items-center gap-2.5 rounded border border-ink/25 bg-cloud px-3 py-2.5">
      {isPdf
        ? <FileText size={18} className="shrink-0 text-accent" style={{ filter: 'drop-shadow(0 0 4px rgba(220,80,0,0.5))' }} />
        : <Image size={18} className="shrink-0 text-warn" style={{ filter: 'drop-shadow(0 0 4px rgba(242,177,52,0.5))' }} />
      }
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{file.name}</p>
        <p className="text-xs text-ink-soft">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="term-chip shrink-0 rounded-full p-1 text-ink-soft hover:text-ink"
        aria-label="Remove selected file"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function DocumentUploader({ open, uploading, onClose, onUpload }: DocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('Identity')
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // >5 MB images: let the user choose KEEP ORIGINAL or OPTIMIZE before uploading.
  const [optimizeChoice, setOptimizeChoice] = useState<'original' | 'optimize' | null>(null)
  const [optimizedFile, setOptimizedFile] = useState<File | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset form state whenever the uploader opens
  useEffect(() => {
    if (open) {
      setFile(null)
      setName('')
      setCategory('Identity')
      setFileError(null)
      setIsDragging(false)
      setOptimizeChoice(null)
      setOptimizedFile(null)
      setOptimizing(false)
      // Focus the name input after animation settles
      setTimeout(() => nameInputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploading) onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose, uploading])

  // Prevent background scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const handleFileChange = (incoming: File | null | undefined) => {
    if (!incoming) return
    const err = validateDocumentFile(incoming)
    if (err) {
      setFileError(err)
      setFile(null)
      return
    }
    setFileError(null)
    setFile(incoming)
    setOptimizeChoice(shouldOfferOptimize(incoming) ? 'optimize' : null)
    setOptimizedFile(null)
    // Auto-populate the name field from the filename if it's still empty
    if (!name.trim()) {
      const baseName = incoming.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
      setName(baseName)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files?.[0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Guard against re-entry while an upload or a compression is already in flight.
    if (!file || !name.trim() || uploading || optimizing) return

    // Resolve the single file to submit:
    //   - <=5 MB, or >5 MB "Keep Original", or PDF: use the original file as-is.
    //   - >5 MB image + "Optimize": compress FIRST; on any failure fall back to the
    //     original file. The original File object is always retained as the fallback,
    //     so we never lose data. After resolution we call onUpload exactly ONCE.
    let uploadFile = file
    if (optimizeChoice === 'optimize' && !optimizedFile) {
      setOptimizing(true)
      try {
        const compressed = await compressImage(file)
        if (compressed) {
          setOptimizedFile(compressed)
          uploadFile = compressed
        }
      } finally {
        setOptimizing(false)
      }
    } else if (optimizedFile) {
      uploadFile = optimizedFile
    }

    // Single submission point — never call onUpload more than once per submission.
    await onUpload(uploadFile, name.trim(), category)
  }

  const canSubmit = file !== null && name.trim().length > 0 && !uploading && !optimizing

  const acceptedTypes = ALLOWED_MIME_TYPES.join(',')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!uploading) onClose() }}
        >
          <motion.div
            className="term-panel term-brackets w-full overflow-hidden rounded sm:max-w-md sm:rounded"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink/15 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <FolderOpen
                  size={18}
                  className="text-accent shrink-0"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(220,80,0,0.5))' }}
                  aria-hidden="true"
                />
                <h2 className="font-display text-base font-bold uppercase tracking-tight text-ink">
                  Add Document
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="term-chip rounded-full p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 grid gap-4">
              {/* File picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                onChange={handleInputChange}
                className="hidden"
                aria-label="Choose document file"
              />

              {file ? (
                <FilePill file={file} onClear={() => { setFile(null); setFileError(null); setOptimizeChoice(null); setOptimizedFile(null) }} />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded border-2 border-dashed transition-colors ${
                    isDragging
                      ? 'border-accent bg-accent/5 text-ink'
                      : 'border-ink/25 text-ink-soft hover:border-ink/50 hover:text-ink'
                  }`}
                >
                  <Upload size={22} />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Choose file or drag &amp; drop
                  </span>
                  <span className="text-[10px] text-ink-soft/70 uppercase tracking-wider">
                    PDF · JPEG · PNG · WebP · Max {MAX_DOC_BYTES / (1024 * 1024)} MB
                  </span>
                </button>
              )}

              {/* Large-image optimization choice (only shown for >5 MB raster images) */}
              {file && optimizeChoice && (
                <div className="rounded border border-accent/40 bg-accent/5 p-3">
                  <div className="flex items-center gap-2">
                    <Minimize2 size={14} className="text-accent shrink-0" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">
                      This image is over 5 MB
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    Optimize it to upload faster and save storage, or keep the original file.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOptimizeChoice('optimize')}
                      disabled={optimizing}
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                        optimizeChoice === 'optimize' ? 'term-btn-primary' : 'border border-ink/30 text-ink-soft hover:text-ink'
                      }`}
                    >
                      {optimizing ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 size={12} className="animate-spin" /> Optimizing…
                        </span>
                      ) : optimizedFile ? (
                        'Optimized ✓'
                      ) : (
                        'Optimize'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOptimizeChoice('original'); setOptimizedFile(null) }}
                      disabled={optimizing}
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                        optimizeChoice === 'original' ? 'term-btn-primary' : 'border border-ink/30 text-ink-soft hover:text-ink'
                      }`}
                    >
                      Keep original
                    </button>
                  </div>
                </div>
              )}

              {/* File validation error */}
              {fileError && (
                <div className="flex items-start gap-2 rounded border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Document name */}
              <div>
                <label
                  htmlFor="doc-name"
                  className="text-xs font-semibold uppercase tracking-widest text-ink-soft"
                >
                  Document name *
                </label>
                <input
                  ref={nameInputRef}
                  id="doc-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aadhaar Card"
                  required
                  maxLength={120}
                  className="term-input mt-1.5 w-full rounded-none px-3 py-2.5 text-sm text-ink"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="doc-category"
                  className="text-xs font-semibold uppercase tracking-widest text-ink-soft"
                >
                  Category *
                </label>
                <VaultSelect<DocumentCategory>
                  options={DOCUMENT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                  value={category}
                  onSelect={setCategory}
                  ariaLabel="Document category"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="term-btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
                >
                  {uploading
                    ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                    : <><Upload size={13} /> Upload</>
                  }
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={uploading}
                  className="rounded-outline border border-ink/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
