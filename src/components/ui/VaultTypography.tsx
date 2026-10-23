import type { HTMLAttributes } from 'react'
import type { ElementType } from 'react'
import { cn } from '../../design/cn'

/**
 * VaultHeading — semantic section/dialog heading with an optional folio.
 * Renders the `.vault-section-title` role (Inter, natural casing).
 */
type VaultHeadingProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  folio?: string
}

export function VaultHeading({ as: Component = 'h2', folio, className, children, ...rest }: VaultHeadingProps) {
  return (
    <Component className={cn('vault-section-title flex items-center gap-2', className)} {...rest}>
      {folio ? <span className="vault-label text-ink-soft/60">{folio}</span> : null}
      {children}
    </Component>
  )
}

