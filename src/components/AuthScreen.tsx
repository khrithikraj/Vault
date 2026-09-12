import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { AuthPresentationState } from '../types/auth'
import { AccessionDocument } from './accession/AccessionDocument'

type AuthMode = 'sign-in' | 'sign-up' | 'recovery' | 'verification'

type AuthScreenProps = {
  authState: AuthPresentationState
  configured: boolean
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onForgotPassword: (email: string) => Promise<void>
  onResendVerification: (email: string) => Promise<void>
  onResetState: () => void
  onReturnToCatalogue: () => void
  onPreview?: () => void
}

export function AuthScreen({
  authState,
  configured,
  onSignIn,
  onSignUp,
  onForgotPassword,
  onResendVerification,
  onResetState,
  onReturnToCatalogue,
  onPreview,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationActive, setVerificationActive] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const busy = authState.kind === 'submitting'
  const error = authState.kind === 'error' ? authState.message : ''

  useEffect(() => {
    titleRef.current?.focus()
  }, [mode, authState.kind])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  useEffect(() => {
    if (authState.kind !== 'verification-pending') return
    setVerificationEmail(authState.email)
    setVerificationActive(true)
  }, [authState])

  useEffect(() => {
    if (!resendCooldown) return
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const changeMode = (nextMode: AuthMode) => {
    onResetState()
    setVerificationActive(false)
    setMode(nextMode)
    setPassword('')
    setPasswordVisible(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      if (mode === 'sign-up') await onSignUp(email.trim(), password)
      else if (mode === 'recovery') await onForgotPassword(email.trim())
      else if (mode === 'verification') await onResendVerification(email.trim())
      else await onSignIn(email.trim(), password)
    } catch {
      // The typed auth state owns the accessible error summary.
    }
  }

  if (!configured) {
    return (
      <AccessionDocument
        frame="Sign in · 13"
        status="Unavailable"
        folio="Service status"
        title="Sign-in is unavailable."
        titleRef={titleRef}
      >
        <p className="accession-auth-copy">
          Try again later. Your email and password were not sent.
        </p>
        <div className="accession-auth-actions">
          <button type="button" className="accession-auth-secondary" onClick={onReturnToCatalogue}>
            Return home
          </button>
        </div>
        {(import.meta.env.DEV || !configured) && onPreview ? (
          <div className="accession-auth-utility">
            <button type="button" className="accession-auth-secondary" onClick={onPreview}>
              Open demo
            </button>
          </div>
        ) : null}
      </AccessionDocument>
    )
  }

  if (authState.kind === 'verified') {
    return (
      <AccessionDocument
        frame="Verify email · 11"
        status="Verified"
        folio="Email verification"
        title="Email verified."
        titleRef={titleRef}
        ruleState="solid"
      >
        <p className="accession-auth-copy">Your email is confirmed. You can now sign in.</p>
        <div className="accession-auth-actions">
          <button type="button" className="accession-auth-primary" onClick={() => changeMode('sign-in')}>
            Sign in
          </button>
        </div>
      </AccessionDocument>
    )
  }

  if (authState.kind === 'verification-pending' || verificationActive) {
    const pendingEmail = authState.kind === 'verification-pending' ? authState.email : verificationEmail
    const resendBusy = authState.kind === 'submitting' && authState.action === 'resend-verification'
    return (
      <AccessionDocument
        frame="Verify email · 11"
        status="Waiting"
        folio="Email verification"
        title="Check your email."
        titleRef={titleRef}
      >
        <p className="accession-auth-copy">We sent you a verification link. Open it to continue.</p>
        {error ? <p ref={errorRef} tabIndex={-1} className="accession-auth-error" role="alert">{error}</p> : null}
        <p className="accession-auth-receipt">{pendingEmail}</p>
        <div className="accession-auth-actions">
          <button
            type="button"
            className="accession-auth-primary"
            disabled={resendBusy || resendCooldown > 0}
            onClick={() => {
              setResendCooldown(30)
              void onResendVerification(pendingEmail).catch(() => undefined)
            }}
          >
            {resendBusy ? 'Sending…' : resendCooldown > 0 ? `Send again in ${resendCooldown}s` : 'Send again'}
          </button>
          <button
            type="button"
            className="accession-auth-secondary"
            onClick={() => {
              setEmail(pendingEmail)
              changeMode('sign-up')
            }}
          >
            Use a different email
          </button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {resendBusy ? 'Sending email.' : 'Waiting for email verification.'}
        </p>
      </AccessionDocument>
    )
  }

  if (authState.kind === 'recovery-sent') {
    return (
      <AccessionDocument
        frame="Reset password · 12"
        status="Email sent"
        folio="Password reset"
        title="Check your email."
        titleRef={titleRef}
      >
        <p className="accession-auth-copy">
          If an account exists for this email, we&apos;ll send a password reset link.
        </p>
        <p className="accession-auth-receipt">{authState.email}</p>
        <div className="accession-auth-actions">
          <button type="button" className="accession-auth-secondary" onClick={() => changeMode('sign-in')}>
            Back to sign in
          </button>
        </div>
      </AccessionDocument>
    )
  }

  if (authState.kind === 'link-error') {
    const recovery = authState.flow === 'recovery'
    return (
      <AccessionDocument
        frame={`${recovery ? 'Reset password' : 'Verify email'} · ${recovery ? '12' : '11'}`}
        status="Link invalid"
        folio={recovery ? 'Password reset' : 'Email verification'}
        title={`This ${recovery ? 'password reset' : 'verification'} link has expired or is invalid.`}
        titleRef={titleRef}
      >
        <p className="accession-auth-error" role="alert">{authState.message}</p>
        <div className="accession-auth-actions">
          <button
            type="button"
            className="accession-auth-primary"
            onClick={() => changeMode(recovery ? 'recovery' : 'verification')}
          >
            Send another link
          </button>
        </div>
      </AccessionDocument>
    )
  }

  const signingUp = mode === 'sign-up'
  const recovering = mode === 'recovery'
  const reverifying = mode === 'verification'
  const title = recovering
    ? 'Reset your password.'
    : reverifying
      ? 'Resend verification email.'
    : signingUp
      ? 'Create an account.'
      : 'Sign in.'

  return (
    <AccessionDocument
      frame={`${recovering ? 'Reset password' : reverifying ? 'Verify email' : signingUp ? 'Create account' : 'Sign in'} · ${recovering ? '12' : reverifying ? '11' : '10'}`}
      status={recovering || reverifying ? 'Email required' : 'Email and password'}
      folio={recovering ? 'Password reset' : reverifying ? 'Email verification' : signingUp ? 'Create account' : 'Sign in'}
      title={title}
      titleRef={titleRef}
      plate={!recovering && !reverifying}
      footer={(import.meta.env.DEV && onPreview) ? (
        <button type="button" onClick={onPreview}>Open demo</button>
      ) : null}
    >
      {error ? <p ref={errorRef} tabIndex={-1} className="accession-auth-error" role="alert">{error}</p> : null}
      <form className="accession-auth-form" onSubmit={handleSubmit} aria-busy={busy}>
        <div className="accession-auth-field">
          <label htmlFor="auth-email">Email</label>
          <span className="accession-auth-input">
            <input
              id="auth-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              aria-invalid={error ? true : undefined}
            />
          </span>
        </div>

        {!recovering && !reverifying ? (
          <div className="accession-auth-field">
            <label htmlFor="auth-password">Password</label>
            <span className="accession-auth-input">
              <input
                id="auth-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={passwordVisible ? 'text' : 'password'}
                autoComplete={signingUp ? 'new-password' : 'current-password'}
                minLength={6}
                required
                aria-describedby={signingUp ? 'password-requirement' : undefined}
                aria-invalid={error ? true : undefined}
              />
              <button
                type="button"
                className="accession-auth-reveal"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            {signingUp ? <span id="password-requirement" className="accession-auth-help">At least 6 characters.</span> : null}
          </div>
        ) : null}

        <div className="accession-auth-actions">
          <button type="submit" className="accession-auth-primary" disabled={busy}>
            {busy
              ? recovering || reverifying ? 'Sending…' : signingUp ? 'Creating account…' : 'Signing in…'
              : recovering ? 'Send reset link' : reverifying ? 'Send verification email' : signingUp ? 'Create account' : 'Sign in'}
          </button>
          {recovering || reverifying ? (
            <button type="button" className="accession-auth-secondary" onClick={() => changeMode('sign-in')}>
              Back to sign in
            </button>
          ) : null}
        </div>
      </form>

      {!recovering && !reverifying ? (
        <div className="accession-auth-utilities">
          <button
            type="button"
            className="accession-auth-secondary"
            onClick={() => changeMode(signingUp ? 'sign-in' : 'sign-up')}
          >
            {signingUp ? 'Sign in' : 'Create account'}
          </button>
          {!signingUp ? (
            <button type="button" className="accession-auth-secondary" onClick={() => changeMode('recovery')}>
              Forgot password?
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? 'Please wait.' : ''}
      </p>
    </AccessionDocument>
  )
}
