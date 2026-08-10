import { useState } from 'react'
import { motion } from 'motion/react'
import { AmbientBackground } from './AmbientBackground'
import { ShimmerText } from './ShimmerText'

type UpdatePasswordScreenProps = {
  message: string
  onUpdatePassword: (password: string) => Promise<void>
}

export function UpdatePasswordScreen({ message, onUpdatePassword }: UpdatePasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AmbientBackground />

      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="term-panel term-brackets w-full max-w-md rounded p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Raj&apos;s</p>
        <ShimmerText
          as="h1"
          text="Choose a new password."
          className="mt-2 block text-2xl font-bold uppercase leading-tight tracking-tight"
        />
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          You're in via your reset link — set a new password to finish.
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
          </motion.button>
        </form>

        {localError || message ? (
          <p className="mt-4 text-sm text-ink-soft">{localError || message}</p>
        ) : null}
      </motion.section>
    </main>
  )
}
