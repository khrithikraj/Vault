import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CopyButtonProps = {
  /** The plain text to copy when clicked. */
  text: string
  label?: string
  /** Shown while the "Copied ✓" state is active (kept short so small pills don't wrap). */
  copiedLabel?: string
  className?: string
}

/** Writes to the clipboard with a navigator.clipboard first / execCommand fallback path
 * (the legacy path covers non-secure contexts and older engines). Shows "Copied ✓" and
 * silently ignores failure — this is an affordance, not a blocking action. */
export function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
        } finally {
          document.body.removeChild(textarea)
        }
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — stay quiet rather than throwing from a UI handler.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      title={label}
      className={`term-chip flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        copied ? 'text-accent' : 'text-ink-soft hover:text-ink'
      } ${className}`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}