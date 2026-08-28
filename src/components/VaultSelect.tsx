import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * VaultSelect — a custom dropdown that replaces the browser's native <select>
 * with one that matches the terminal/vault design language: a bordered trigger,
 * a floating "term-panel" options list, keyboard + outside-click handling.
 *
 * It accepts a list of { value, label } options and reports selection via onSelect.
 * Purely presentational — parent owns the selected value.
 */

export type VaultSelectOption<T extends string = string> = {
  value: T
  label: string
}

type VaultSelectProps<T extends string = string> = {
  options: VaultSelectOption<T>[]
  value: T
  onSelect: (value: T) => void
  disabled?: boolean
  /** Open the list upward instead of downward — useful inside short scroll containers. */
  up?: boolean
  className?: string
  ariaLabel?: string
}

export function VaultSelect<T extends string = string>({
  options,
  value,
  onSelect,
  disabled = false,
  up = false,
  className = '',
  ariaLabel,
}: VaultSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const current = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((openNow) => !openNow)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="term-input flex w-full items-center justify-between gap-2 rounded-none px-2.5 py-2 text-left text-sm font-medium text-ink disabled:opacity-60"
      >
        <span className="truncate capitalize">{current?.label ?? 'Select…'}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`term-panel term-scrollbar absolute left-0 right-0 z-30 max-h-60 overflow-y-auto rounded border bg-cloud p-1 shadow-xl ${
              up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {options.map((option) => {
              const selected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors ${
                    selected ? 'bg-ink/10 text-ink' : 'text-ink-soft hover:bg-ink/5 hover:text-ink'
                  }`}
                >
                  <span className="capitalize">{option.label}</span>
                  {selected ? <Check size={14} className="text-accent shrink-0" /> : null}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
