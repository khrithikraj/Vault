import type { ReactNode } from 'react'
import { VaultDialog } from './VaultDialog'

/**
 * VaultSheet — a bottom-docked sheet (mobile-friendly) built on VaultDialog.
 * Includes a grabber handle that hints at portability and sets the sheet to
 * slide up from the bottom. Purely presentational; gesture/drag dismissal is
 * a later-phase enhancement.
 */
type VaultSheetProps = {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  showClose?: boolean
  closeLabel?: string
  className?: string
  bodyClassName?: string
  footer?: ReactNode
  children?: ReactNode
  /** Tail height of the bottom-safe-area padding. */
  safeBottom?: boolean
}

export function VaultSheet({
  open,
  onClose,
  title,
  showClose = false,
  closeLabel,
  className,
  bodyClassName,
  footer,
  children,
  safeBottom = true,
}: VaultSheetProps) {
  return (
    <VaultDialog
      open={open}
      onClose={onClose}
      title={title}
      variant="sheet"
      showClose={showClose}
      closeLabel={closeLabel}
      className={className}
      bodyClassName={bodyClassName}
      footer={footer}
      backdropOpacity={0.6}
    >
      <div className={`${safeBottom ? 'mb-2 vault-pad-safe-b' : ''}`}>
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-ink/15" aria-hidden="true" />
        {children}
      </div>
    </VaultDialog>
  )
}
