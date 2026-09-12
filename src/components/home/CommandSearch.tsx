import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Search, X } from 'lucide-react'
import { reducedMotion } from '../../design/motion'

type CommandSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

/**
 * V2 — Command Search.
 *
 * Replaces the flat SearchBar with a deliberate, editorial command surface.
 * On rest: compact labeled strip with muted search icon.
 * On focus: expands vertically, icon brightens, a crosshair hint appears below —
 * this is the "enter the archive" moment.
 *
 * Design principles:
 * - No layout shift of surrounding content (motion is contained to this element)
 * - Ember accent ring on focus, not just a border color change
 * - Animated clear button — fades in with text, never shifts the icon position
 * - Hint line below on focus ("Enter the archive") — editorial and minimal
 */
export function CommandSearch({ value, onChange, placeholder }: CommandSearchProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasText = value.length > 0

  const focusInput = () => inputRef.current?.focus()

  return (
    <div
      className="relative mx-auto w-full max-w-2xl"
      onClick={focusInput}
    >
      {/* Search surface */}
      <motion.div
        layout="size"
        transition={reducedMotion({ type: 'spring', stiffness: 320, damping: 32 })}
        className={`cmd-surface flex items-center gap-3 rounded px-4 sm:px-5 ${
          focused ? 'py-4' : 'py-3'
        }`}
      >
        {/* Search icon — brightens on focus */}
        <motion.span
          animate={{
            opacity: focused ? 0.85 : 0.45,
            scale: focused ? 1.1 : 1,
          }}
          transition={reducedMotion({ duration: 0.2, ease: 'easeOut' })}
          className="shrink-0 text-accent"
          aria-hidden="true"
        >
          <Search size={focused ? 18 : 16} strokeWidth={1.8} />
        </motion.span>

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && hasText) {
              event.preventDefault()
              onChange('')
            }
          }}
          placeholder={focused ? 'Search across your entire archive…' : placeholder}
          aria-label="Search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/45 focus:outline-none focus-visible:outline-none sm:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden"
        />

        {/* Clear button — fades in with text */}
        <motion.button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onChange('')
            focusInput()
          }}
          aria-label="Clear search"
          aria-hidden={!hasText}
          tabIndex={hasText ? 0 : -1}
          animate={{ opacity: hasText ? 0.6 : 0, scale: hasText ? 1 : 0.8 }}
          whileHover={{ opacity: 1 }}
          transition={reducedMotion({ duration: 0.18, ease: 'easeOut' })}
          className={`shrink-0 rounded p-1 text-ink-soft transition-colors hover:text-ink ${
            hasText ? '' : 'pointer-events-none'
          }`}
        >
          <X size={14} />
        </motion.button>
      </motion.div>

      {/* "Enter the archive" hint — appears on focus */}
      <AnimatePresence>
        {focused ? (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={reducedMotion({ duration: 0.18, ease: 'easeOut' })}
            className="mt-2.5 flex items-center justify-center gap-3"
          >
            <span aria-hidden="true" className="h-px flex-1 max-w-[3rem] bg-ink/10" />
            <span className="folio text-[9px] tracking-[0.28em] text-ink-soft/30">
              Enter the archive
            </span>
            <span aria-hidden="true" className="h-px flex-1 max-w-[3rem] bg-ink/10" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
