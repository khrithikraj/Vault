import { motion } from 'motion/react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { VaultEmptyState } from './ui/VaultEmptyState'
import { VaultSection } from './ui/VaultSection'
import { buildTrashRows } from '../lib/trashRows'
import type { TrashRow } from '../lib/trashRows'
import type { TrashKind } from '../lib/trash'
import type { Category, Note, VaultDocument, VaultItem } from '../types/app'

export type { TrashRow }

const deletedDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function restoreLabel(kind: TrashKind): string {
  if (kind === 'note') return 'Restore note'
  if (kind === 'document') return 'Restore document'
  return 'Restore item'
}

type TrashListProps = {
  rows: TrashRow[]
  onRestore: (row: TrashRow) => void
  onPurge: (row: TrashRow) => void
}

/** Shared list used by the Trash section and by trash-scoped search results.
 *  Same `.vault-card` container + top-row actions + divider/footer grammar as
 *  Items/Notes/Documents — restore and permanent-delete are compact icon-only. */
export function TrashList({ rows, onRestore, onPurge }: TrashListProps) {
  if (rows.length === 0) {
    return (
      <VaultEmptyState
        title="Recently Deleted is empty"
        description="Deleted items, notes, and documents will appear here until you restore or permanently remove them."
      />
    )
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {rows.map((row) => (
        <motion.div
          key={`${row.kind}-${row.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="vault-card flex min-w-0 flex-col overflow-hidden p-4 sm:p-5"
        >
          {/* Top row: name + compact actions */}
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-display text-sm font-semibold uppercase leading-snug tracking-tight text-ink">
              {row.name}
            </p>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => onRestore(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/40 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                title={restoreLabel(row.kind)}
                aria-label={restoreLabel(row.kind)}
              >
                <RotateCcw size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onPurge(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/30 transition-colors hover:bg-ink/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                title={`Delete ${row.name} permanently`}
                aria-label={`Delete ${row.name} permanently`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Metadata line */}
          <div className="min-w-0 flex-1 px-0 pb-3 pt-2">
            <p className="truncate text-xs text-ink-soft">
              {row.meta} · Deleted
            </p>
          </div>

          {/* Divider + deletion date */}
          <div className="mx-0 h-px bg-ink/[0.07]" />
          <div className="flex items-center justify-between gap-2 px-0 pt-2.5">
            <span className="folio text-[10px] text-ink-soft/60">
              {deletedDate.format(new Date(row.deletedAt))}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

type TrashPanelProps = {
  items: VaultItem[]
  notes: Note[]
  documents: VaultDocument[]
  categories: Category[]
  onRestoreItem: (item: VaultItem) => void
  onPurgeItem: (item: VaultItem) => void
  onRestoreNote: (note: Note) => void
  onPurgeNote: (note: Note) => void
  onRestoreDoc: (doc: VaultDocument) => void
  onPurgeDoc: (doc: VaultDocument) => void
}

/** The Recently Deleted section — a single merged, restore/purge list. */
export function TrashPanel({
  items,
  notes,
  documents,
  categories,
  onRestoreItem,
  onPurgeItem,
  onRestoreNote,
  onPurgeNote,
  onRestoreDoc,
  onPurgeDoc,
}: TrashPanelProps) {
  const rows = buildTrashRows({ items, notes, documents, categories })

  return (
    <VaultSection
      className="mt-10"
      label="Recently Deleted"
      folio="01"
      title="Recently Deleted"
      right={
        <span className="vault-meta text-ink-soft/55">
          {rows.length} {rows.length === 1 ? 'item' : 'items'}
        </span>
      }
    >
      <TrashList
        rows={rows}
        onRestore={(row) => {
          if (row.kind === 'item') {
            const item = items.find((i) => i.id === row.id)
            if (item) onRestoreItem(item)
          } else if (row.kind === 'note') {
            const note = notes.find((n) => n.id === row.id)
            if (note) onRestoreNote(note)
          } else {
            const doc = documents.find((d) => d.id === row.id)
            if (doc) onRestoreDoc(doc)
          }
        }}
        onPurge={(row) => {
          if (row.kind === 'item') {
            const item = items.find((i) => i.id === row.id)
            if (item) onPurgeItem(item)
          } else if (row.kind === 'note') {
            const note = notes.find((n) => n.id === row.id)
            if (note) onPurgeNote(note)
          } else {
            const doc = documents.find((d) => d.id === row.id)
            if (doc) onPurgeDoc(doc)
          }
        }}
      />
    </VaultSection>
  )
}