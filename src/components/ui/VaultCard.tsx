import { forwardRef } from 'react'
import type { HTMLAttributes, ElementType } from 'react'
import { cn } from '../../design/cn'

/**
 * VaultCard — the elevated surface/card base.
 *
 * Renders the standard "term-panel" surface (Bark Brown + Cork border) with
 * an optional inline bevel (cream-top / dark-sepia) that was previously
 * hard-coded inline across several cards.
 *
 * options:
 *   - soft        → use the softer #2a1c11 surface (term-panel-soft)
 *   - overlay     → use the page-surface variant (for in-overlay cards)
 *   - brackets    → add the corner-bracket reticle marks
 *   - bevel       → add the inset cream/dark bevel
 *   - as          → render as another element (default div)
 */
type VaultCardProps = HTMLAttributes<HTMLElement> & {
  soft?: boolean
  overlay?: boolean
  brackets?: boolean
  bevel?: boolean
  as?: ElementType
}

export const VaultCard = forwardRef<HTMLElement, VaultCardProps>(function VaultCard(
  { soft, overlay, brackets, bevel, as: Component = 'div', className, children, ...rest },
  ref,
) {
  const base = overlay ? 'vault-surface-overlay' : soft ? 'vault-surface-soft' : 'vault-surface'
  return (
    <Component
      ref={ref}
      className={cn(base, 'rounded', brackets && 'vault-brackets', bevel && 'vault-bevel', className)}
      {...rest}
    >
      {children}
    </Component>
  )
})
