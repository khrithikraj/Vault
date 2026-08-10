import { useState } from 'react'
import { motion } from 'motion/react'
import { Atmosphere } from './Atmosphere'
import { BorderTrail } from './BorderTrail'
import { ShimmerText } from './ShimmerText'
import { VerticalSerial } from './VerticalSerial'
import { VaultArtifact } from './VaultArtifact'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type UpdatePasswordScreenProps = {
  message: string
  onUpdatePassword: (password: string) => Promise<void>
}

export function UpdatePasswordScreen({ message, onUpdatePassword }: UpdatePasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setLocalError("Passwords don't match.")
      return
    }
    setLocalError('')
    setLoading(true)
    try {
      await onUpdatePassword(password)
    } catch {
      // message already surfaced by the hook
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-16">
      <Atmosphere variant="full" />
      <VerticalSerial label="RAJ'S — RESET PASSWORD" />

      <motion.div
        {...(reducedMotion
          ? {}
          : {
              animate: { y: [0, -8, 0] },
              transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            })}
      >
        <VaultArtifact size={64} />
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 40, rotateX: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.15 }}
        style={{ transformPerspective: 900 }}
        className="term-panel term-brackets rim-light relative w-full max-w-md overflow-hidden rounded p-8"
      >
        <BorderTrail color="rgba(220,80,0,0.55)" size={84} duration={8} />

        <p className="text-micro text-ink-soft">Raj&apos;s — account recovery</p>
        <div style={{ '--text-display': 'clamp(1.6rem, 5.5vw, 2.75rem)' } as React.CSSProperties}>
          <ShimmerText
            as="h1"
            text="Choose a new password."
            className="text-display mt-2 block"
          />
        </div>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          You&apos;re in via your reset link — set a new password to finish.
        </p>

        <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-xs uppercase tracking-widest text-ink-soft">
            New password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={6}
              required
              className="term-input rounded-none px-3 py-2.5 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-widest text-ink-soft">
            Confirm password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              minLength={6}
              required
              className="term-input rounded-none px-3 py-2.5 text-sm text-ink"
            />
          </label>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="term-btn-primary mt-2 rounded-full px-4 py-3 text-sm font-semibold uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Update password'}
            <span className="term-cursor" />
          </motion.button>
        </form>

        {localError || message ? (
          <p className="mt-4 text-sm text-ink-soft">{localError || message}</p>
        ) : null}
      </motion.section>
    </main>
  )
}
