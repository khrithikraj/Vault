import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownUp, Check } from 'lucide-react'
import { layers } from '../../design/layers'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

type SortOption<T extends string> = { value: T; label: string }

type SortMenuProps<T extends string> = {
  value: T
  options: SortOption<T>[]
  onChange: (value: T) => void
}

/** Small dropdown button used in the toolbar row above Items/Docs/Notes grids. */
export function SortMenu<T extends string>({ value, options, onChange }: SortMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const current = options.find((option) => option.value === value)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))

  const closeMenu = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return
    const onClickAway = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setOpen(false)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(true)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        setActiveIndex((currentIndex) => {
          if (event.key === 'Home') return 0
          if (event.key === 'End') return options.length - 1
          const offset = event.key === 'ArrowDown' ? 1 : -1
          return (currentIndex + offset + options.length) % options.length
        })
        return
      }
      if ((event.key === 'Enter' || event.key === ' ') && document.activeElement !== triggerRef.current) {
        event.preventDefault()
        const option = options[activeIndex]
        if (option) {
          onChange(option.value)
          closeMenu(true)
        }
      }
    }
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onKey)
    }
  }, [activeIndex, onChange, open, options])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [activeIndex, open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) closeMenu()
          else {
            setActiveIndex(selectedIndex)
            setOpen(true)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex(event.key === 'ArrowDown' ? selectedIndex : Math.max(0, options.length - 1))
            setOpen(true)
          }
        }}
        className="vault-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Sort by ${current?.label ?? 'selected option'}`}
      >
        <ArrowDownUp size={13} aria-hidden="true" />
        <span className="hidden sm:inline">{current?.label ?? 'Sort'}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
            className="vault-surface absolute right-0 mt-1.5 w-44 overflow-hidden rounded p-1 shadow-glass"
            style={{ zIndex: layers.dropdown }}
          >
            {options.map((option, index) => (
              <li key={option.value}>
                <button
                  ref={(element) => { optionRefs.current[index] = element }}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value)
                    closeMenu(true)
                  }}
                  tabIndex={index === activeIndex ? 0 : -1}
                  className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium text-ink-soft hover:bg-ink/5 hover:text-ink"
                >
                  {option.label}
                  {option.value === value ? <Check size={13} className="text-accent" /> : null}
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
