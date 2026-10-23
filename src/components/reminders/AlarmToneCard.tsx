import { useEffect, useState, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  Volume2,
  Play,
  Square,
  RotateCcw,
  Sliders,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'
import {
  VaultAlarm,
  type RingtoneInfoResult,
} from '../../native/alarmBridge'

export function AlarmToneCard() {
  const isNative = Capacitor.isNativePlatform()

  const [tone, setTone] = useState<RingtoneInfoResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  const loadCurrentTone = useCallback(async () => {
    if (!isNative) return
    setLoading(true)
    setError(null)
    try {
      const info = await VaultAlarm.getRingtone()
      setTone(info)
    } catch (err) {
      console.error('Failed to get ringtone:', err)
      setError('Unable to read tone settings')
    } finally {
      setLoading(false)
    }
  }, [isNative])

  useEffect(() => {
    loadCurrentTone()
  }, [loadCurrentTone])

  // Stop preview on unmount
  useEffect(() => {
    return () => {
      if (isNative && previewing) {
        VaultAlarm.stopRingtonePreview().catch(() => {})
      }
    }
  }, [isNative, previewing])

  const handleChooseTone = async () => {
    if (!isNative || actionLoading) return
    setActionLoading(true)
    setError(null)
    try {
      if (previewing) {
        await VaultAlarm.stopRingtonePreview()
        setPreviewing(false)
      }
      const result = await VaultAlarm.selectRingtone()
      if (result.selected) {
        setTone({
          uri: result.uri,
          title: result.title,
          isDefault: result.isDefault,
        })
        showFeedback(result.isDefault ? 'Default tone selected' : 'Alarm tone updated')
      }
    } catch (err: unknown) {
      console.error('Failed to select ringtone:', err)
      const msg = err instanceof Error ? err.message : 'Selection failed'
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleTogglePreview = async () => {
    if (!isNative || actionLoading) return
    setActionLoading(true)
    setError(null)
    try {
      if (previewing) {
        await VaultAlarm.stopRingtonePreview()
        setPreviewing(false)
      } else {
        await VaultAlarm.previewRingtone()
        setPreviewing(true)
      }
    } catch (err) {
      console.error('Failed to toggle preview:', err)
      setError('Playback failed')
      setPreviewing(false)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRestoreDefault = async () => {
    if (!isNative || actionLoading) return
    setActionLoading(true)
    setError(null)
    try {
      if (previewing) {
        await VaultAlarm.stopRingtonePreview()
        setPreviewing(false)
      }
      const result = await VaultAlarm.resetRingtone()
      setTone({
        uri: null,
        title: result.title,
        isDefault: true,
      })
      showFeedback('Restored system default')
    } catch (err) {
      console.error('Failed to reset ringtone:', err)
      setError('Reset failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Web / PWA fallback view
  if (!isNative) {
    return (
      <div className="mb-6 rounded-xl border border-border-dash bg-surface/40 px-4 py-3 text-xs text-ink-soft/75">
        <div className="flex items-center gap-2">
          <Volume2 size={15} className="text-accent/80 shrink-0" />
          <span>
            <strong className="text-ink font-medium">Alarm Tone:</strong> Audio playback is native to the installed Android app.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-border-dash bg-surface/60 p-4 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Icon & Tone Details */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-dash bg-background/80 text-accent">
            <Volume2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="vault-label text-ink-soft">
                Alarm Tone
              </span>
              {tone?.isDefault && (
                <span className="vault-label rounded border border-border-dash bg-surface-soft px-1.5 py-0.5 text-ink-soft/70">
                  Default
                </span>
              )}
            </div>
            <div className="vault-body-secondary mt-0.5 truncate font-medium text-ink">
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-ink-soft/60">
                  <Loader2 size={12} className="animate-spin" /> Loading tone…
                </span>
              ) : (
                tone?.title || 'Default Alarm Tone'
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Preview / Stop button */}
          <button
            type="button"
            onClick={handleTogglePreview}
            disabled={loading || actionLoading}
            title={previewing ? 'Stop audio preview' : 'Preview current tone'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              previewing
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-dash bg-surface-soft text-ink hover:border-ink/30 hover:text-ink'
            } disabled:opacity-50`}
          >
            {previewing ? <Square size={13} className="fill-current" /> : <Play size={13} className="fill-current" />}
            <span>{previewing ? 'Stop' : 'Preview'}</span>
          </button>

          {/* Choose Tone */}
          <button
            type="button"
            onClick={handleChooseTone}
            disabled={loading || actionLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-dash bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            <Sliders size={13} />
            <span>Choose tone</span>
          </button>

          {/* Restore Default button (visible when custom tone is set) */}
          {!tone?.isDefault && (
            <button
              type="button"
              onClick={handleRestoreDefault}
              disabled={loading || actionLoading}
              title="Restore system default alarm tone"
              className="inline-flex items-center gap-1 rounded-lg border border-border-dash bg-surface-soft p-1.5 text-xs text-ink-soft hover:border-ink/30 hover:text-ink transition-colors disabled:opacity-50"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Transient Feedback / Status */}
      {feedback && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-accent">
          <Check size={12} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
