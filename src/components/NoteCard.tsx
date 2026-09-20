import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import type { Note } from '../types/app'
import type { ItemFieldHit } from '../lib/search'
import { isNoteFavorite } from '../lib/favorites'
import { DoneStamp } from './DoneStamp'
import { FavoriteButton } from './ui/FavoriteButton'

type NoteCardProps = {
  note: Note
  index: number
  /** Optional matched fields (for search results) — shown in place of the body preview. */
  matchFields?: ItemFieldHit[]
  onClick: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}

const prettyDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })

export function NoteCard({ note, index, matchFields, onClick, onDelete, onToggleFavorite }: NoteCardProps) {
  const doneCount = note.checklist.filter((entry) => entry.done).length
  const allDone = note.checklist.length > 0 && doneCount === note.checklist.length
  const showMatch = matchFields && matchFields.length > 0
  const titleText = note.title.trim() || 'Untitled note'
  const favoriteLabel = isNoteFavorite(note) ? `Remove ${note.title || 'note'} from favorites` : `Add ${note.title || 'note'} to favorites`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -4,
        rotateX: -4,
        rotateY: index % 2 === 0 ? -2 : 2,
      }}
      whileTap={{ scale: 0.98 }}
      style={{ transformPerspective: 800 }}
      onClick={onClick}
      className="vault-card group flex flex-col overflow-hidden cursor-pointer select-none"
      role="button"
      tabIndex={0}
      aria-label={`Open note ${titleText}`}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
        event.preventDefault()
        onClick()
      }}
    >
      {/* Header row — title (flexible, wraps) + pinned actions */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <h3 className={`min-w-0 font-display font-semibold uppercase leading-snug tracking-tight text-ink transition-colors group-hover:text-accent text-[0.95rem] sm:text-base ${allDone ? 'pr-1' : ''}`}>
          {titleText}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <FavoriteButton
            active={isNoteFavorite(note)}
            label={favoriteLabel}
            onToggle={onToggleFavorite}
            size={13}
            boxClassName="h-8 w-8"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/30 transition-colors hover:bg-ink/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            title={`Delete note ${titleText}`}
            aria-label={`Delete note ${titleText}`}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body — search matches or note preview */}
      <div className="flex-1 px-4 pb-3 pt-2">
        {showMatch && matchFields ? (
          <div className="space-y-0.5">
            {matchFields.slice(0, 2).map((hit, hitIndex) => (
              <p key={`${hit.label}-${hitIndex}`} className="truncate text-xs sm:text-sm text-ink-soft">
                <span className="font-medium">{hit.label}:</span> {hit.value}
              </p>
            ))}
          </div>
        ) : note.body.trim() ? (
          <p className="line-clamp-2 text-xs sm:text-sm text-ink-soft leading-relaxed">
            {note.body}
          </p>
        ) : (
          <p className="text-xs italic text-ink-soft/50">No text content</p>
        )}
      </div>

      {/* Divider + footer — date + checklist progress, same slot language as Items */}
      <div className="mx-4 h-px bg-ink/[0.07]" />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-ink-soft/40">
          <span className="shrink-0">{prettyDate.format(new Date(note.updated_at || note.created_at))}</span>
          {note.checklist.length > 0 ? (
            <>
              <span className="shrink-0 text-ink-soft/30" aria-hidden="true">·</span>
              <span className="truncate">
                {doneCount}/{note.checklist.length} tasks
              </span>
            </>
          ) : null}
        </span>
        {allDone && <DoneStamp />}
      </div>
    </motion.div>
  )
}