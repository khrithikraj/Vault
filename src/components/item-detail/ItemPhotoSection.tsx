import { useRef } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { VaultButton } from '../ui/VaultButton'

type ItemPhotoSectionProps = {
  title: string
  editing: boolean
  imageUrl: string | null
  onSelect: (file: File) => void
  onRemove: () => void
}

export function ItemPhotoSection({
  title,
  editing,
  imageUrl,
  onSelect,
  onRemove,
}: ItemPhotoSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (editing) {
    return (
      <div className="mb-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onSelect(file)
          }}
          className="hidden"
        />
        {imageUrl ? (
          <div className="relative overflow-hidden border border-ink/20">
            <img src={imageUrl} alt={`Preview for ${title}`} className="h-44 w-full object-cover" />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <VaultButton type="button" variant="soft" size="sm" icon={Camera} onClick={() => inputRef.current?.click()}>
                Change photo
              </VaultButton>
              <VaultButton type="button" variant="danger" size="sm" icon={Trash2} onClick={onRemove}>
                Remove photo
              </VaultButton>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-full flex-col items-center justify-center gap-1.5 border border-dashed border-ink/30 text-ink-soft transition-colors hover:border-ink/60 hover:text-ink"
          >
            <Camera size={20} aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">Attach photo</span>
          </button>
        )}
      </div>
    )
  }

  return imageUrl ? (
    <div className="relative -mx-5 -mt-5 mb-5 h-52 w-[calc(100%+2.5rem)] overflow-hidden border-b border-ink/20 sm:-mx-7 sm:-mt-7 sm:h-56 sm:w-[calc(100%+3.5rem)]">
      <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-cloud/70 to-transparent" aria-hidden="true" />
    </div>
  ) : null
}