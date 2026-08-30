import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import type { Note } from '../types/app'
import type { ItemFieldHit } from '../lib/search'

type NoteCardProps = {
  note: Note
  index: number
  /** Optional matched fields (for search results) — shown in place of the body preview. */
  matchFields?: ItemFieldHit[]
  onClick: () => void
  onDelete: () => void
}

const prettyDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })

export function NoteCard({ note, index, matchFields, onClick, onDelete }: NoteCardProps) {
  const doneCount = note.checklist.filter((entry) => entry.done).length
  const allDone = note.checklist.length > 0 && doneCount === note.checklist.length
  const showMatch = matchFields && matchFields.length > 0

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
      className="term-panel term-brackets relative flex flex-col justify-between overflow-hidden rounded p-4 sm:p-5 text-left cursor-pointer group"
    >
      {allDone && (
        <span className="border-accent text-accent pointer-events-none absolute right-3 top-3 -rotate-12 rounded-sm border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] opacity-90">
          Done
        </span>
      )}

      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-display font-semibold uppercase leading-snug text-ink group-hover:text-accent transition-colors text-base truncate">
            {note.title.trim() || 'Untitled note'}
          </p>
          <span className="shrink-0 text-xs text-ink-soft">
            {prettyDate.format(new Date(note.updated_at || note.created_at))}
          </span>
        </div>

        {showMatch && matchFields ? (
          <div className="mt-2 space-y-0.5">
            {matchFields.slice(0, 2).map((hit, hitIndex) => (
              <p key={`${hit.label}-${hitIndex}`} className="truncate text-xs sm:text-sm text-ink-soft">
                <span className="font-medium">{hit.label}:</span> {hit.value}
              </p>
            ))}
          </div>
        ) : note.body.trim() ? (
          <p className="mt-2 line-clamp-3 text-xs sm:text-sm text-ink-soft leading-relaxed">
            {note.body}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-ink-soft/50">No text content</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-dashed border-ink/15 pt-2 text-xs text-ink-soft">
        <div>
          {note.checklist.length > 0 ? (
            <span className="font-medium text-ink-soft">
              {doneCount}/{note.checklist.length} tasks done
            </span>
          ) : (
            <span>Note</span>
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className="term-chip reveal-on-hover rounded-full p-1 text-ink-soft/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete note"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  )
}