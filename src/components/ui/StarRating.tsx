import { Star } from 'lucide-react'

type StarRatingProps = {
  value: number
  /** Omit onChange to render a read-only display (used on cards/summaries). */
  onChange?: (value: number) => void
  size?: number
  max?: number
}

/** Compact 1-5 tappable star rating. Read-only when `onChange` isn't provided. */
export function StarRating({ value, onChange, size = 15, max = 5 }: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, index) => index + 1)
  const readOnly = !onChange

  return (
    <div className={`inline-flex items-center gap-0.5 ${readOnly ? '' : ''}`} role={readOnly ? undefined : 'radiogroup'} aria-label="Rating">
      {stars.map((star) => {
        const filled = star <= value
        return readOnly ? (
          <Star
            key={star}
            size={size}
            className={filled ? 'fill-accent text-accent' : 'text-ink-soft/30'}
            aria-hidden="true"
          />
        ) : (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            aria-pressed={filled}
          >
            <Star
              size={size}
              className={filled ? 'fill-accent text-accent' : 'text-ink-soft/30'}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </div>
  )
}
