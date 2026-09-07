import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../design/cn'

type VaultInputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: 'default' | 'overlay'
}

/**
 * VaultInput — text field matching the terminal/vault input vocabulary.
 * Backed by the `.term-input` / `.vault-input` class.
 */
export const VaultInput = forwardRef<HTMLInputElement, VaultInputProps>(function VaultInput(
  { variant = 'default', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded px-3 py-2.5 text-sm transition-colors placeholder:text-ink-soft/80',
        variant === 'overlay' ? 'vault-input-overlay' : 'term-input',
        className,
      )}
      {...rest}
    />
  )
})

type VaultTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: 'default' | 'overlay'
}

/**
 * VaultTextarea — multi-line variant of VaultInput.
 */
export const VaultTextarea = forwardRef<HTMLTextAreaElement, VaultTextareaProps>(
  function VaultTextarea({ variant = 'default', className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded px-3 py-2.5 text-sm transition-colors placeholder:text-ink-soft/80',
          variant === 'overlay' ? 'vault-input-overlay' : 'term-input',
          className,
        )}
        {...rest}
      />
    )
  },
)
