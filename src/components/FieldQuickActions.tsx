import { ExternalLink, Mail, MapPin, Phone, X } from 'lucide-react'
import { CopyButton } from './CopyButton'
import { callUrl, mailtoUrl, mapsUrl, quickActionsFor, type FieldValueKind } from '../lib/quickActions'

type FieldQuickActionsProps = {
  value: string
  /** The field's type from the category field schema, if any. */
  fieldType?: string
  /** Sensible field label to help detect addresses (e.g. "Address", "Venue"). */
  label?: string
  /** Optional delete affordance shown when the field row supports removing the value. */
  onClear?: () => void
}

/** Renders a Copy chip plus contextual quick actions for a single stored
 *  value (open URL / email / call / maps) based on value kind detection. */
export function FieldQuickActions({ value, fieldType, label, onClear }: FieldQuickActionsProps) {
  if (!value) return null

  const actions = quickActionsFor(value, fieldType, label)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <CopyButton text={value} label="Copy" />
      {actions.map((action) => {
        if (action.kind === 'open-url') {
          return (
            <a
              key={action.kind}
              href={action.url}
              target="_blank"
              rel="noreferrer"
              className="term-chip flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-accent hover:bg-accent/10"
            >
              <ExternalLink size={12} /> Open
            </a>
          )
        }
        if (action.kind === 'mail') {
          return (
            <a
              key={action.kind}
              href={mailtoUrl(value)}
              className="term-chip flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-accent hover:bg-accent/10"
            >
              <Mail size={12} /> Email
            </a>
          )
        }
        if (action.kind === 'call') {
          return (
            <a
              key={action.kind}
              href={callUrl(action.tel)}
              className="term-chip flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-accent hover:bg-accent/10"
            >
              <Phone size={12} /> Call
            </a>
          )
        }
        if (action.kind === 'maps') {
          return (
            <a
              key={action.kind}
              href={mapsUrl(action.query)}
              target="_blank"
              rel="noreferrer"
              className="term-chip flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-accent hover:bg-accent/10"
            >
              <MapPin size={12} /> Maps
            </a>
          )
        }
        return null
      })}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="term-chip flex items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-soft hover:text-warn"
        >
          <X size={12} /> Clear
        </button>
      ) : null}
    </div>
  )
}

export type { FieldValueKind }