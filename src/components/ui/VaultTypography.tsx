import type { HTMLAttributes } from 'react'
import type { ElementType } from 'react'
import { cn } from '../../design/cn'

/**
 * VaultHeading — section heading (small-caps display with optional folio).
 * Renders the `.vault-heading` type role.
 */
type VaultHeadingProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  folio?: string
}

export function VaultHeading({ as: Component = 'h2', folio, className, children, ...rest }: VaultHeadingProps) {
  return (
    <Component className={cn('vault-heading flex items-center gap-2', className)} {...rest}>
      {folio ? <span className="folio text-xs text-ink-soft/50">{folio}</span> : null}
      {children}
    </Component>
  )
}

/**
 * VaultLabel — small semibold label for forms/fields.
 */
export function VaultLabel({
  as: Component = 'label',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return <Component className={cn('vault-label', className)} {...rest} />
}

/**
 * VaultMeta — compact muted secondary/metadata text.
 */
export function VaultMeta({
  as: Component = 'span',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return <Component className={cn('vault-meta', className)} {...rest} />
}

/**
 * VaultBody — default body copy (Inter).
 */
export function VaultBody({
  as: Component = 'p',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return <Component className={cn('vault-body', className)} {...rest} />
}
