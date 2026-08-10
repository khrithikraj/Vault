import type { LucideIcon } from 'lucide-react'
import { BookOpen, Clapperboard, Landmark, MapPin, ShoppingBag, Soup, Sparkles, Tag, Watch } from 'lucide-react'

/** Maps the default seed emoji (and any custom emoji a user happens to type into the
 * category icon input) to a real SVG icon. Unrecognized emoji fall back to `Tag`. */
const EMOJI_ICON_MAP: Record<string, LucideIcon> = {
  '🍜': Soup,
  '🛍️': ShoppingBag,
  '🛍': ShoppingBag,
  '⌚': Watch,
  '🎬': Clapperboard,
  '🛕': Landmark,
  '📚': BookOpen,
  '📍': MapPin,
  '✨': Sparkles,
}

function iconForEmoji(emoji: string | undefined | null): LucideIcon {
  if (!emoji) return Tag
  return EMOJI_ICON_MAP[emoji] ?? Tag
}

type CategoryIconProps = {
  /** The raw emoji stored on the category (or a custom one the user typed in). */
  icon: string
  /** The category's own hex color — the only place color is allowed to appear in this UI. */
  color: string
  size?: number
  className?: string
}

/** Renders a category's icon as a colorful SVG, tinted with the category's own color and
 * given a soft matching glow — the one deliberate splash of color against the monochrome UI. */
export function CategoryIcon({ icon, color, size = 22, className }: CategoryIconProps) {
  const Icon = iconForEmoji(icon)
  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={2}
      className={className}
      style={{ color, filter: `drop-shadow(0 0 6px ${color}80)` }}
    />
  )
}

type BrandIconProps = {
  icon: LucideIcon
  size?: number
  className?: string
  tone?: 'accent' | 'warn'
}

/** Fixed-color icon for "branded" UI elements that aren't tied to a category (dock tabs,
 * lock badge, checkmark, etc.) — uses the shared accent/warn colors instead of a category color. */
export function BrandIcon({ icon: Icon, size = 22, className, tone = 'accent' }: BrandIconProps) {
  const color = tone === 'warn' ? 'var(--color-warn)' : 'var(--color-accent)'
  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={2}
      className={className}
      style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}
    />
  )
}
