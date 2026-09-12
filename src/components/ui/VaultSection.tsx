import type { ReactNode } from 'react'
import { cn } from '../../design/cn'

/**
 * A ruled, folio-numbered content section for authenticated pages.
 */
type VaultSectionProps = {
  title?: ReactNode
  folio?: string
  right?: ReactNode
  label?: string
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

export function VaultSection({
  title,
  folio,
  right,
  label,
  className,
  bodyClassName,
  children,
}: VaultSectionProps) {
  return (
    <section className={cn('vault-section mt-12', className)} aria-label={label}>
      {title ? (
        <header className="vault-section-header">
          {folio ? <span className="vault-section-folio">{folio}</span> : null}
          <h2 className="vault-section-title">{title}</h2>
          {right ? <div className="vault-section-actions">{right}</div> : null}
        </header>
      ) : null}
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  )
}
