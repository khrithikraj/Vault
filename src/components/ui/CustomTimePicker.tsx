import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { formatReminderTime, parseLocalTime, to24HourTime } from '../../lib/reminders'

export type CustomTimePickerProps = {
  value: string // 24-hour "HH:MM" format or "" for unselected
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}

type TimeDraft = { hour: string; minute: string; period: 'AM' | 'PM' }

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

  // Always-latest mirror so blur/step/toggle handlers never act on a stale closure.
  // Assigned during render and inside commitTime. React flushes state synchronously
  // between discrete events, so the mirror is current by the time the next handler runs.
  const draftRef = useRef<TimeDraft>({ hour: draftHour, minute: draftMinute, period: draftPeriod })
  draftRef.current = { hour: draftHour, minute: draftMinute, period: draftPeriod }

  // Set whenever any control inside the picker has focus. The external-value sync
  // effect must NEVER clobber fields the user is actively editing — previously it
  // unconditionally reset the AM/PM period, so under load a freshly committed PM
  // selection could be reverted to AM before the assertion saw it.
  const pickerFocused = useRef(false)

  // Sync drafts from an external value change (e.g. the dialog reopens with a saved
  // reminder) only when the user isn't interacting with the picker. All user-driven
  // commits already update the drafts through commitTime, so this is purely for
  // outside-in changes while the picker is idle.
  useEffect(() => {
    if (pickerFocused.current) return
    const p = parseLocalTime(value)
    const next: TimeDraft = p
      ? {
          hour: String(p.hour12).padStart(2, '0'),
          minute: String(p.minute).padStart(2, '0'),
          period: p.period,
        }
      : { hour: '', minute: '', period: 'AM' }
    setDraftHour(next.hour)
    setDraftMinute(next.minute)
    setDraftPeriod(next.period)
    draftRef.current = next
  }, [value])

  /** Clamp, normalise, and commit a complete time to the parent. */
  const commitTime = (hStr: string, mStr: string, period: 'AM' | 'PM') => {
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    const validH = isNaN(h) ? 9 : Math.max(1, Math.min(12, h))
    const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
    const next: TimeDraft = {
      hour: String(validH).padStart(2, '0'),
      minute: String(validM).padStart(2, '0'),
      period,
    }
    setDraftHour(next.hour)
    setDraftMinute(next.minute)
    setDraftPeriod(next.period)
    draftRef.current = next
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
        const { minute, period } = draftRef.current
        commitTime(String(num), minute, period)
      }
    }
  }

  const handleHourFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus so typing immediately replaces the old value
    e.target.select()
  }

  const handleHourBlur = () => {
    const { hour, minute, period } = draftRef.current
    commitTime(hour, minute, period)
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
        const { hour, period } = draftRef.current
        commitTime(hour, String(num), period)
      }
    }
  }

  const handleMinuteFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus so typing immediately replaces the old value
    e.target.select()
  }

  const handleMinuteBlur = () => {
    const { hour, minute, period } = draftRef.current
    commitTime(hour, minute, period)
  }

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleMinuteBlur()
    if (e.key === 'ArrowUp') { e.preventDefault(); handleMinuteStep(1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleMinuteStep(-1) }
  }

  // ── Stepper buttons ────────────────────────────────────────────────────────

  const handleHourStep = (delta: number) => {
    const { hour, minute, period } = draftRef.current
    const currentH = parseInt(hour, 10) || 9
    let next = currentH + delta
    if (next > 12) next = 1
    if (next < 1) next = 12
    commitTime(String(next), minute, period)
  }

  const handleMinuteStep = (delta: number) => {
    const { hour, minute, period } = draftRef.current
    const currentM = parseInt(minute, 10)
    const base = isNaN(currentM) ? 0 : currentM
    let next = base + delta
    if (next >= 60) next = 0
    if (next < 0) next = 59
    commitTime(hour, String(next), period)
  }

  const handlePeriodToggle = (p: 'AM' | 'PM') => {
    const { hour, minute } = draftRef.current
    commitTime(hour, minute, p)
  }

  return (
    <div
      className="flex flex-col gap-2.5"
      id={id}
      onFocus={() => { pickerFocused.current = true }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pickerFocused.current = false
      }}
    >
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
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-ink/10 active:scale-95 transition-all"
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
              className={`inline-flex h-10 items-center justify-center rounded px-2.5 text-xs font-bold transition-all ${
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
              className={`inline-flex h-10 items-center justify-center rounded px-2.5 text-xs font-bold transition-all ${
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