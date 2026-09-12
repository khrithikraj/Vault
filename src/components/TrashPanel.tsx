import { motion } from 'motion/react'
import { NotebookPen, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { VaultEmptyState } from './ui/VaultEmptyState'
import { VaultSection } from './ui/VaultSection'
import { deletedLabel } from '../lib/trash'
import { buildTrashRows } from '../lib/trashRows'
import type { TrashRow } from '../lib/trashRows'
import type { TrashKind } from '../lib/trash'
import type { Category, Note, VaultDocument, VaultItem } from '../types/app'

export type { TrashRow }

function KindIcon({ kind }: { kind: TrashKind }) {
  if (kind === 'note') return <NotebookPen size={16} className="shrink-0 text-warn" />
  if (kind === 'document') return <Sparkles size={16} className="shrink-0 text-accent" />
  return <Sparkles size={16} className="shrink-0 text-accent" />
}

type TrashListProps = {
  rows: TrashRow[]
  onRestore: (row: TrashRow) => void
  onPurge: (row: TrashRow) => void
}

/** Shared list used by the Trash section and by trash-scoped search results. */
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
    <div className="mt-4 grid gap-2.5">
      {rows.map((row) => (
        <motion.div
          key={`${row.kind}-${row.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="vault-surface vault-brackets flex items-center gap-3 rounded p-3 sm:p-4"
        >
          <span className="bg-ink/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <KindIcon kind={row.kind} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-sm font-semibold uppercase tracking-tight text-ink">
              {row.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {row.meta} · {deletedLabel(row.deletedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRestore(row)}
              className="vault-chip flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink hover:text-ink"
            >
              <RotateCcw size={12} /> Restore
            </button>
            <button
              type="button"
              onClick={() => onPurge(row)}
              className="vault-chip flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 hover:text-red-300"
              aria-label={`Delete ${row.name} permanently`}
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline">Delete forever</span>
            </button>
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