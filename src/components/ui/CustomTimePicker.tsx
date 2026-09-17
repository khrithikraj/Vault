import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { formatReminderTime, parseLocalTime, to24HourTime } from '../../lib/reminders'

export type CustomTimePickerProps = {
  value: string // 24-hour "HH:MM" format or "" for unselected
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}

export function CustomTimePicker({
  value,
  onChange,
  disabled = false,
  id,
}: CustomTimePickerProps) {
  const parsed = parseLocalTime(value)
  const isSet = parsed !== null

  // Local draft states — these are the "raw" values while the user is typing
  const [draftHour, setDraftHour] = useState<string>(
    parsed ? String(parsed.hour12).padStart(2, '0') : '',
  )
  const [draftMinute, setDraftMinute] = useState<string>(
    parsed ? String(parsed.minute).padStart(2, '0') : '',
  )
  const [draftPeriod, setDraftPeriod] = useState<'AM' | 'PM'>(parsed?.period ?? 'AM')

  // Track which field is focused so useEffect doesn't clobber mid-edit input
  const hourFocused = useRef(false)
  const minuteFocused = useRef(false)

  // Sync draft from external value prop ONLY when not actively editing that field
  useEffect(() => {
    const p = parseLocalTime(value)
    if (p) {
      if (!hourFocused.current) {
        setDraftHour(String(p.hour12).padStart(2, '0'))
      }
      if (!minuteFocused.current) {
        setDraftMinute(String(p.minute).padStart(2, '0'))
      }
      setDraftPeriod(p.period)
    } else {
      if (!hourFocused.current) setDraftHour('')
      if (!minuteFocused.current) setDraftMinute('')
      setDraftPeriod('AM')
    }
  }, [value])

  /** Clamp, normalise, and commit a complete time to the parent. */
  const commitTime = (hStr: string, mStr: string, period: 'AM' | 'PM') => {
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    const validH = isNaN(h) ? 9 : Math.max(1, Math.min(12, h))
    const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
    setDraftHour(String(validH).padStart(2, '0'))
    setDraftMinute(String(validM).padStart(2, '0'))
    setDraftPeriod(period)
    onChange(to24HourTime(validH, validM, period))
  }

  // ── Hour field ─────────────────────────────────────────────────────────────

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 2 chars
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDraftHour(raw)
    // Eagerly commit only if it's already a fully valid value (1–12)
    // so the "Selected Time" badge updates live without breaking multi-digit entry.
    if (raw.length === 2) {
      const num = parseInt(raw, 10)
      if (!isNaN(num) && num >= 1 && num <= 12) {
        const m = parseInt(draftMinute, 10)
        const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
        onChange(to24HourTime(num, validM, draftPeriod))
      }
    }
  }

  const handleHourFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    hourFocused.current = true
    // Select all on focus so typing immediately replaces the old value
    e.target.select()
  }

  const handleHourBlur = () => {
    hourFocused.current = false
    const num = parseInt(draftHour, 10)
    const validH = isNaN(num) ? 9 : Math.max(1, Math.min(12, num))
    const m = parseInt(draftMinute, 10)
    const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
    commitTime(String(validH), String(validM), draftPeriod)
  }

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleHourBlur()
    if (e.key === 'ArrowUp') { e.preventDefault(); handleHourStep(1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleHourStep(-1) }
  }

  // ── Minute field ───────────────────────────────────────────────────────────

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 2 chars. Do NOT call onChange here — wait for blur/Enter
    // so the user can type "3" then "2" without the field being overwritten mid-entry.
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDraftMinute(raw)
    // Only eagerly commit when we have a full 2-digit value that's in range
    if (raw.length === 2) {
      const num = parseInt(raw, 10)
      if (!isNaN(num) && num >= 0 && num <= 59) {
        const h = parseInt(draftHour, 10)
        const validH = isNaN(h) ? 9 : Math.max(1, Math.min(12, h))
        onChange(to24HourTime(validH, num, draftPeriod))
      }
    }
  }

  const handleMinuteFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    minuteFocused.current = true
    // Select all on focus so typing immediately replaces the old value
    e.target.select()
  }

  const handleMinuteBlur = () => {
    minuteFocused.current = false
    const num = parseInt(draftMinute, 10)
    const validM = isNaN(num) ? 0 : Math.max(0, Math.min(59, num))
    const h = parseInt(draftHour, 10)
    const validH = isNaN(h) ? 9 : Math.max(1, Math.min(12, h))
    commitTime(String(validH), String(validM), draftPeriod)
  }

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleMinuteBlur()
    if (e.key === 'ArrowUp') { e.preventDefault(); handleMinuteStep(1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleMinuteStep(-1) }
  }

  // ── Stepper buttons ────────────────────────────────────────────────────────

  const handleHourStep = (delta: number) => {
    const currentH = parseInt(draftHour, 10) || 9
    let next = currentH + delta
    if (next > 12) next = 1
    if (next < 1) next = 12
    const currentM = parseInt(draftMinute, 10)
    const validM = isNaN(currentM) ? 0 : currentM
    commitTime(String(next), String(validM), draftPeriod)
  }

  const handleMinuteStep = (delta: number) => {
    const currentM = parseInt(draftMinute, 10)
    const base = isNaN(currentM) ? 0 : currentM
    let next = base + delta
    if (next >= 60) next = 0
    if (next < 0) next = 59
    const currentH = parseInt(draftHour, 10) || 9
    commitTime(String(currentH), String(next), draftPeriod)
  }

  const handlePeriodToggle = (p: 'AM' | 'PM') => {
    const currentH = parseInt(draftHour, 10) || 9
    const currentM = parseInt(draftMinute, 10)
    const validM = isNaN(currentM) ? 0 : currentM
    commitTime(String(currentH), String(validM), p)
  }

  return (
    <div className="flex flex-col gap-2.5" id={id}>
      {/* Time Display Status Card */}
      <div
        className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-all ${
          isSet
            ? 'bg-cloud/60 border-accent/40 text-ink shadow-sm'
            : 'bg-ink/5 border-dashed border-ink/25 text-ink-soft'
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className={isSet ? 'text-accent' : 'text-ink-soft/60'} />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {isSet ? 'Selected Time' : 'Time'}
          </span>
        </div>
        <span
          className={`font-mono text-sm font-bold tracking-wider ${
            isSet ? 'text-accent' : 'text-ink-soft/70'
          }`}
        >
          {isSet ? formatReminderTime(value) : '--:-- --'}
        </span>
      </div>

      {/* Themed Interactive Time Control */}
      <div className="flex flex-col gap-2 rounded-lg border border-ink/15 bg-cloud/40 p-2.5">
        <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
          {/* Hour Column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleHourStep(1)}
              aria-label="Increase hour"
              className="rounded p-1 text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronUp size={16} />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={disabled}
              value={draftHour}
              onChange={handleHourChange}
              onFocus={handleHourFocus}
              onBlur={handleHourBlur}
              onKeyDown={handleHourKeyDown}
              placeholder="09"
              aria-label="Hour"
              className="font-mono text-xl sm:text-2xl font-bold text-ink w-12 text-center bg-ink/5 rounded border border-ink/10 py-0.5 focus:border-accent focus:bg-cloud outline-none"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleHourStep(-1)}
              aria-label="Decrease hour"
              className="rounded p-1 text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronDown size={16} />
            </button>
            <span className="text-[9px] font-bold uppercase tracking-widest text-ink-soft/60 mt-0.5">
              Hour
            </span>
          </div>

          <span className="font-mono text-xl sm:text-2xl font-bold text-ink-soft select-none pb-4">:</span>

          {/* Minute Column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleMinuteStep(1)}
              aria-label="Increase minute"
              className="rounded p-1 text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronUp size={16} />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={disabled}
              value={draftMinute}
              onChange={handleMinuteChange}
              onFocus={handleMinuteFocus}
              onBlur={handleMinuteBlur}
              onKeyDown={handleMinuteKeyDown}
              placeholder="00"
              aria-label="Minute"
              className="font-mono text-xl sm:text-2xl font-bold text-ink w-12 text-center bg-ink/5 rounded border border-ink/10 py-0.5 focus:border-accent focus:bg-cloud outline-none"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleMinuteStep(-1)}
              aria-label="Decrease minute"
              className="rounded p-1 text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
            >
              <ChevronDown size={16} />
            </button>
            <span className="text-[9px] font-bold uppercase tracking-widest text-ink-soft/60 mt-0.5">
              Min
            </span>
          </div>

          {/* AM / PM Selector */}
          <div className="flex flex-col gap-1 pl-2 border-l border-ink/15 my-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handlePeriodToggle('AM')}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                draftPeriod === 'AM' && isSet
                  ? 'bg-accent text-white shadow-sm'
                  : draftPeriod === 'AM'
                  ? 'bg-ink/15 text-ink font-semibold'
                  : 'text-ink-soft hover:text-ink hover:bg-ink/5'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handlePeriodToggle('PM')}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                draftPeriod === 'PM' && isSet
                  ? 'bg-accent text-white shadow-sm'
                  : draftPeriod === 'PM'
                  ? 'bg-ink/15 text-ink font-semibold'
                  : 'text-ink-soft hover:text-ink hover:bg-ink/5'
              }`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
