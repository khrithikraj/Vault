import { Heart } from 'lucide-react'

type FavoriteButtonProps = {
  active: boolean
  label: string
  onToggle: () => void
  size?: number
  className?: string
  /** Compact control box for tight card action rows (defaults to the roomy 40px). */
  boxClassName?: string
}

export function FavoriteButton({
  active,
  label,
  onToggle,
  size = 15,
  className = '',
  boxClassName = 'h-10 w-10',
}: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? 'text-red-400' : 'text-ink-soft/30 hover:text-red-400'
      } ${boxClassName} ${className}`}
      aria-label={label}
      aria-pressed={active}
    >
      <Heart size={size} className={active ? 'fill-current' : ''} aria-hidden="true" />
    </button>
  )
}