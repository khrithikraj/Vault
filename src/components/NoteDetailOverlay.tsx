import type { Note } from '../types/app'
import { NoteEditor } from './NoteEditor'
import { VaultDialog } from './ui/VaultDialog'

export function NoteDetailOverlay({
  note,
  onClose,
  onDelete,
  onUpdate,
}: {
  note: Note | null
  onClose: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>) => Promise<void>
}) {
  return (
    <VaultDialog
      open={note !== null}
      onClose={onClose}
      title="Note editor"
      showClose
      className="max-w-2xl"
      bodyClassName="vault-scrollbar max-h-[calc(100dvh-8rem)] min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6"
    >
      {note ? (
        <NoteEditor
          note={note}
          onBack={onClose}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      ) : null}
    </VaultDialog>
  )
}
