import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Atmosphere } from './Atmosphere'
import { BorderTrail } from './BorderTrail'
import { ShimmerText } from './ShimmerText'
import { VerticalSerial } from './VerticalSerial'
import { VaultArtifact } from './VaultArtifact'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { supabaseConfigured } from '../lib/supabase'

type AuthScreenProps = {
  message: string
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onForgotPassword: (email: string) => Promise<void>
  /** Dev-only escape hatch into a local mock vault — never rendered in production builds. */
  onPreview?: () => void
}

export function AuthScreen({
  message,
  onSignIn,
  onSignUp,
  onForgotPassword,
  onPreview,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const handleForgotPassword = async () => {
    setResetting(true)
    try {
      await onForgotPassword(email)
    } finally {
      setResetting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (mode === 'up') {
        await onSignUp(email, password)
      } else {
        await onSignIn(email, password)
      }
    } catch {
      // message already surfaced by the hook
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-12 px-4 py-16">
      <Atmosphere variant="full" />
      <VerticalSerial label="RAJ'S — SECURE ENTRY" />

      {/* A lone artifact suspended in warm darkness — the void-mode hero moment. */}
      <motion.div
        {...(reducedMotion
          ? {}
          : {
              animate: { y: [0, -10, 0] },
              transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            })}
      >
        <VaultArtifact size={92} />
      </motion.div>

      <div className="text-center">
        <p className="text-micro text-ink-soft">Raj&apos;s — secure entry</p>
        <div style={{ '--text-display': 'clamp(2rem, 6vw, 4.5rem)' } as React.CSSProperties}>
          <ShimmerText
            as="h1"
            text="Your life, saved beautifully."
            className="text-display mt-2 block text-center"
          />
        </div>
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-ink-soft">
          Sign in to sync every screenshot, wishlist, and idea across your devices.
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 40, rotateX: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.15 }}
        style={{ transformPerspective: 900 }}
        className="term-panel term-brackets rim-light relative w-full max-w-md overflow-hidden rounded p-8"
      >
        <BorderTrail color="rgba(220,80,0,0.55)" size={84} duration={8} />

        <div className="border-ink/30 relative grid grid-cols-2 rounded border">
          {(['in', 'up'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className="relative z-10 py-2 text-sm font-medium uppercase tracking-wide text-ink"
            >
              {mode === tab ? (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="bg-ink absolute inset-0 -z-10 rounded-[1px]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              ) : null}
              <span className={mode === tab ? 'relative text-cloud' : 'relative'}>
                [ {tab === 'in' ? 'Sign in' : 'Sign up'} ]
              </span>
            </button>
          ))}
        </div>

        <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-xs uppercase tracking-widest text-ink-soft">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="term-input rounded-none px-3 py-2.5 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-widest text-ink-soft">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={6}
              required
              className="term-input rounded-none px-3 py-2.5 text-sm text-ink"
            />
          </label>
          {mode === 'in' ? (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetting}
              className="-mt-1 justify-self-end text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-60"
            >
              {resetting ? 'Sending…' : 'Forgot password?'}
            </button>
          ) : null}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="term-btn-primary mt-2 rounded-full px-4 py-3 text-sm font-semibold uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}
            <span className="term-cursor" />
          </motion.button>
        </form>

        <AnimatePresence>
          {message ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 text-sm text-ink-soft"
            >
              {message}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {(import.meta.env.DEV || !supabaseConfigured) && onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            className="border-ink/30 rounded-outline mt-5 w-full border border-dashed py-2 text-xs font-medium uppercase tracking-widest text-ink-soft/70 hover:text-ink-soft"
          >
            {import.meta.env.DEV
              ? 'Dev only: preview without signing in'
              : 'Preview the vault without a database'}
          </button>
        ) : null}
      </motion.section>
    </main>
  )
}
