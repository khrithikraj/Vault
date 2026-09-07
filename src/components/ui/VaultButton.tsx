import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../design/cn'

/**
 * VaultButton — the button system.
 *
 * Variants map to the existing term-* button vocabulary:
 *   - ghost   → term-btn: outlined, fills ember on hover
 *   - solid   → term-btn-primary: the single filled ember pill
 *   - soft    → term-btn-soft: subtle ember-tinted fill
 *   - chip    → term-chip: small pill (dock items / category chips)
 *   - danger  → outlined danger (semantic)
 *
 * `size` accepts a compact set; default balances touch-friendliness.
 */
type VaultButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'solid' | 'soft' | 'chip' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  iconRight?: boolean
}

const variantClasses: Record<NonNullable<VaultButtonProps['variant']>, string> = {
  ghost: 'term-btn rounded',
  solid: 'term-btn-primary rounded-full',
  soft: 'term-btn-soft rounded',
  chip: 'term-chip rounded-full',
  danger: 'vault-danger rounded border',
}

const sizeClasses: Record<NonNullable<VaultButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const VaultButton = forwardRef<HTMLButtonElement, VaultButtonProps>(function VaultButton(
  { variant = 'ghost', size = 'md', icon: Icon, iconRight = false, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'vault-action inline-flex items-center justify-center gap-2 font-medium select-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {Icon && !iconRight ? <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" /> : null}
      {children}
      {Icon && iconRight ? <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" /> : null}
    </button>
  )
})

/**
 * VaultIconButton — a compact square icon control, suitable for overlay
 * close buttons, row delete buttons, etc. Ensures a touch-friendly target
 * even when visually small.
 */
type VaultIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  size?: number
  label: string
  variant?: 'ghost' | 'danger'
}

export const VaultIconButton = forwardRef<HTMLButtonElement, VaultIconButtonProps>(
  function VaultIconButton(
    { icon: Icon, size = 16, label, variant = 'ghost', className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded transition-colors',
          variant === 'danger'
            ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
            : 'text-ink-soft hover:bg-ink/10 hover:text-ink',
          className,
        )}
        {...rest}
      >
        <Icon size={size} className="shrink-0" />
      </button>
    )
  },
)
