import { motion } from 'motion/react'
import { FolderLock, NotebookPen, Search, Sparkles, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandIcon } from '../lib/icons'
import { ArchiveObjects } from './home/ArchiveObjects'
import { NoteCard } from './NoteCard'
import { DocumentCard } from './documents/DocumentCard'
import { TrashList } from './TrashPanel'
import { VaultButton } from './ui/VaultButton'
import { VaultEmptyState } from './ui/VaultEmptyState'
import type { TrashRow } from '../lib/trashRows'
import type { Category, Note, VaultDocument, VaultItem } from '../types/app'
import type { VaultSearchResults } from '../lib/search'

type SearchResultsProps = {
  query: string
  mode: 'everything' | 'category' | 'favorites' | 'notes' | 'documents' | 'trash'
  scopeLabel: string
  results: VaultSearchResults
  categories: Category[]
  onOpenItem: (item: VaultItem) => void
  onToggleItem: (item: VaultItem) => void
  onDeleteItem: (item: VaultItem) => void
  onToggleFavoriteItem: (item: VaultItem) => void
  onOpenNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onToggleFavoriteNote: (note: Note) => void
  onOpenDoc: (doc: VaultDocument) => void
  onDeleteDoc: (doc: VaultDocument) => Promise<boolean>
  onToggleFavoriteDoc: (doc: VaultDocument) => void
  /** Trash mode: pre-built rows (the search query already filtered them). */
  trashRows?: TrashRow[]
  onRestoreTrashRow?: (row: TrashRow) => void
  onPurgeTrashRow?: (row: TrashRow) => void
  onClear: () => void
}

function GroupHeader({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <h3 className="font-display mt-10 mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
      <BrandIcon icon={icon} size={14} /> {label}
    </h3>
  )
}

/** Renders the current section's content area while a search query is active.
 * Reuses the existing vault cards (ArchiveObjects, NoteCard, DocumentCard) so results
 * feel native — just scoped and grouped instead of the normal section layout. */
export function SearchResults({
  query,
  mode,
  scopeLabel,
  results,
  categories,
  onOpenItem,
  onToggleItem,
  onDeleteItem,
  onToggleFavoriteItem,
  onOpenNote,
  onDeleteNote,
  onToggleFavoriteNote,
  onOpenDoc,
  onDeleteDoc,
  onToggleFavoriteDoc,
  trashRows,
  onRestoreTrashRow,
  onPurgeTrashRow,
  onClear,
}: SearchResultsProps) {
  const total = results.items.length + results.notes.length + results.documents.length

  if (total === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
        <VaultEmptyState
          icon={<BrandIcon icon={Search} size={18} />}
          title={`No results in ${scopeLabel}`}
          description={<>Nothing matches &ldquo;{query}&rdquo;. Try another term or clear the search.</>}
          action={<VaultButton onClick={onClear}>Clear search</VaultButton>}
        />
      </motion.div>
    )
  }

  if (mode === 'trash') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
        <h2 className="font-display flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
          <BrandIcon icon={Trash2} size={18} />
          Search results
          <span className="ml-1 text-xs font-normal text-ink-soft/70">· {total} {total === 1 ? 'result' : 'results'} · {scopeLabel}</span>
        </h2>
        <TrashList
          rows={trashRows ?? []}
          onRestore={(row) => onRestoreTrashRow?.(row)}
          onPurge={(row) => onPurgeTrashRow?.(row)}
        />
      </motion.div>
    )
  }

  const hitsMap = new Map(results.items.map((hit) => [hit.item.id, hit.fields]))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
      <h2 className="font-display flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
        <BrandIcon icon={Search} size={18} />
        Search results
        <span className="ml-1 text-xs font-normal text-ink-soft/70">· {total} {total === 1 ? 'result' : 'results'} · {scopeLabel}</span>
      </h2>

      {mode === 'everything' || mode === 'category' || mode === 'favorites' ? (
        results.items.length > 0 ? (
          <>
            {mode === 'everything' ? <GroupHeader icon={Sparkles} label="Items" /> : null}
            <ArchiveObjects
              items={results.items.map((hit) => hit.item)}
              categories={categories}
              searchHits={hitsMap}
              showCategory={mode === 'everything'}
              onOpen={onOpenItem}
              onToggle={onToggleItem}
              onDelete={onDeleteItem}
              onToggleFavorite={onToggleFavoriteItem}
            />
          </>
        ) : null
      ) : null}

      {mode === 'everything' || mode === 'favorites' || mode === 'notes' ? (
        results.notes.length > 0 ? (
          <>
            {mode === 'everything' ? (
              <>
                <div className="divider-dash mt-8" />
                <GroupHeader icon={NotebookPen} label="Notes" />
              </>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {results.notes.map((hit, index) => (
                <NoteCard
                  key={hit.note.id}
                  note={hit.note}
                  index={index}
                  matchFields={hit.fields}
                  onClick={() => onOpenNote(hit.note.id)}
                  onDelete={() => onDeleteNote(hit.note.id)}
                  onToggleFavorite={() => onToggleFavoriteNote(hit.note)}
                />
              ))}
            </div>
          </>
        ) : null
      ) : null}

      {mode === 'everything' || mode === 'favorites' || mode === 'documents' ? (
        results.documents.length > 0 ? (
          <>
            {mode === 'everything' ? (
              <>
                <div className="divider-dash mt-8" />
                <GroupHeader icon={FolderLock} label="Documents" />
              </>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {results.documents.map((doc, index) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  index={index}
                  onClick={() => onOpenDoc(doc)}
                  onDelete={() => void onDeleteDoc(doc)}
                  onToggleFavorite={() => onToggleFavoriteDoc(doc)}
                />
              ))}
            </div>
          </>
        ) : null
      ) : null}
    </motion.div>
  )
}