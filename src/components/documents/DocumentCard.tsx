/**
 * DocumentCard — a single document entry in the Documents grid.
 *
 * Uses the shared `.vault-card` container + the same action/footer grammar as
 * Items and Notes: title left, favourite + delete right, metadata underneath,
 * hairline divider, date-only footer. No Mark Done, no item markers.
 *
 * Delete stays in its reserved compact action slot — always visible on touch
 * (no opacity-0 hover dependency), subtle hover/focus reveal language intact on
 * pointer devices via the shared `.vault-card` hover.
 */

import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import type { VaultDocument } from '../../types/app'
import { FavoriteButton } from '../ui/FavoriteButton'

type DocumentCardProps = {
  doc: VaultDocument
  index: number
  onClick: () => void
  onDelete: () => void
  onToggleFavorite: () => void
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

export function DocumentCard({ doc, index, onClick, onDelete, onToggleFavorite }: DocumentCardProps) {
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
      className="vault-card group flex flex-col overflow-hidden cursor-pointer select-none"
      role="button"
      tabIndex={0}
      aria-label={`Open ${doc.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Header row: name + actions */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <h3 className="min-w-0 font-display font-semibold uppercase leading-snug tracking-tight text-ink transition-colors group-hover:text-accent text-sm sm:text-base">
          {doc.name}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <FavoriteButton
            active={doc.is_favorite}
            label={doc.is_favorite ? `Remove ${doc.name} from favorites` : `Add ${doc.name} to favorites`}
            onToggle={onToggleFavorite}
            size={13}
            boxClassName="h-8 w-8"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/30 transition-colors hover:bg-ink/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            title="Delete document"
            aria-label={`Delete ${doc.name}`}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Metadata line */}
      <div className="flex-1 px-4 pb-3 pt-2">
        <p className="truncate text-xs text-ink-soft">
          {doc.category} · {mimeLabel(doc.mime_type)} · {formatBytes(doc.file_size)}
        </p>
      </div>

      {/* Divider + date-only footer */}
      <div className="mx-4 h-px bg-ink/[0.07]" />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="folio text-[10px] text-ink-soft/60">
          {prettyDate.format(new Date(doc.created_at))}
        </span>
      </div>
    </motion.div>
  )
}