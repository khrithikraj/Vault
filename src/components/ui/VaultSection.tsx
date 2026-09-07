import type { ReactNode } from 'react'
import { cn } from '../../design/cn'
import { VaultHeading } from './VaultTypography'

/**
 * VaultSection — a page "beat" with a folio-numbered heading and body.
 * Standardizes the section heading + spacing pattern used throughout.
 */
type VaultSectionProps = {
  title?: ReactNode
  folio?: string
  right?: ReactNode
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

export function VaultSection({
  title,
  folio,
  right,
  className,
  bodyClassName,
  children,
}: VaultSectionProps) {
  return (
    <section className={cn('mt-12', className)}>
      {title ? (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <VaultHeading folio={folio}>{title}</VaultHeading>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  )
}
