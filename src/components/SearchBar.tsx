import { Search, X } from 'lucide-react'
import { BrandIcon } from '../lib/icons'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

/** Vault-wide search input — styled natively for Raj's Vault (term-panel card, cream ink,
 * ember focus). Sits below the hero, above the current section content. The clear button is
 * always mounted so layout never jumps while typing; it's just inert until there is text. */
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const hasText = value.length > 0

  return (
    <div className="term-panel term-brackets rim-light mt-4 flex items-center gap-2.5 rounded px-3 py-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 transition-colors sm:px-4 sm:py-3">
      <BrandIcon icon={Search} size={18} className="shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onChange('')
        }}
        placeholder={placeholder}
        aria-label="Search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className="text-ink placeholder:text-ink-soft/70 min-w-0 flex-1 bg-transparent text-sm focus:outline-none focus-visible:outline-none sm:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden"
      />
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        aria-hidden={!hasText}
        tabIndex={hasText ? 0 : -1}
        className={`term-chip shrink-0 rounded-full p-1.5 text-ink-soft transition-opacity hover:text-ink focus-visible:opacity-100 ${
          hasText ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <X size={14} />
      </button>
    </div>
  )
}