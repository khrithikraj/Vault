/**
 * DocumentCard — a single document entry in the Documents grid.
 *
 * Design follows the NotesPanel card pattern exactly:
 *   - .term-panel .term-brackets
 *   - Motion lift on hover (3D, same spring as note cards)
 *   - Delete button appears on hover (opacity-0 → opacity-100)
 *   - .font-display uppercase for the document name
 *   - .folio for the date
 *   - No sensitive document content is rendered — only name, category, type, size.
 */

import { motion } from 'motion/react'
import { FileText, Image, Trash2 } from 'lucide-react'
import type { VaultDocument } from '../../types/app'

type DocumentCardProps = {
  doc: VaultDocument
  index: number
  onClick: () => void
  onDelete: () => void
}

const prettyDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mimeLabel(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf': return 'PDF'
    case 'image/jpeg': return 'JPEG'
    case 'image/png': return 'PNG'
    case 'image/webp': return 'WebP'
    default: return mimeType.split('/')[1]?.toUpperCase() ?? 'File'
  }
}

function DocTypeIcon({ mimeType, size = 20 }: { mimeType: string; size?: number }) {
  const isPdf = mimeType === 'application/pdf'
  const color = isPdf ? 'var(--color-accent)' : 'var(--color-warn)'
  const filter = `drop-shadow(0 0 5px ${color}80)`
  return isPdf
    ? <FileText size={size} strokeWidth={2} style={{ color, filter }} aria-hidden="true" />
    : <Image size={size} strokeWidth={2} style={{ color, filter }} aria-hidden="true" />
}

export function DocumentCard({ doc, index, onClick, onDelete }: DocumentCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ y: -4, rotateX: -3, rotateY: index % 2 === 0 ? -1.5 : 1.5 }}
      whileTap={{ scale: 0.98 }}
      style={{ transformPerspective: 800 }}
      onClick={onClick}
      className="term-panel term-brackets relative flex flex-col justify-between overflow-hidden rounded p-4 sm:p-5 cursor-pointer group"
      role="button"
      tabIndex={0}
      aria-label={`Open ${doc.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Header row: icon + name */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <DocTypeIcon mimeType={doc.mime_type} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold uppercase leading-snug text-ink group-hover:text-accent transition-colors text-sm sm:text-base truncate">
            {doc.name}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {doc.category} · {mimeLabel(doc.mime_type)} · {formatBytes(doc.file_size)}
          </p>
        </div>
      </div>

      {/* Footer row: date + delete button */}
      <div className="mt-4 flex items-center justify-between border-t border-dashed border-ink/15 pt-2">
        <span className="folio text-[10px] text-ink-soft/60">
          {prettyDate.format(new Date(doc.created_at))}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="term-chip rounded-full p-1 text-ink-soft/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete document"
          aria-label={`Delete ${doc.name}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  )
}
