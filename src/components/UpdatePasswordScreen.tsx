import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { AuthPresentationState } from '../types/auth'
import { AccessionDocument } from './accession/AccessionDocument'

type UpdatePasswordScreenProps = {
  authState: AuthPresentationState
  onUpdatePassword: (password: string) => Promise<void>
}

export function UpdatePasswordScreen({ authState, onUpdatePassword }: UpdatePasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const busy = authState.kind === 'submitting' && authState.action === 'update-password'
  const error = authState.kind === 'error' ? authState.message : ''

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await onUpdatePassword(password)
    } catch {
      // The typed auth state owns the accessible error summary.
    }
  }

  return (
    <AccessionDocument
      frame="Reset password · 12"
      status={authState.kind === 'restored' ? 'Password updated' : 'Link verified'}
      folio="Password reset"
      title={authState.kind === 'restored' ? 'Password updated.' : 'Choose a new password.'}
      titleRef={titleRef}
      ruleState={authState.kind === 'restored' ? 'solid' : 'provisional'}
    >
      {authState.kind === 'restored' ? (
        <p className="accession-auth-copy" role="status">Continuing…</p>
      ) : (
        <>
          {error ? <p ref={errorRef} tabIndex={-1} className="accession-auth-error" role="alert">{error}</p> : null}
          <form className="accession-auth-form" onSubmit={handleSubmit} aria-busy={busy}>
            <div className="accession-auth-field">
              <label htmlFor="new-password">New password</label>
              <span className="accession-auth-input">
                <input
                  id="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  aria-describedby="new-password-requirement"
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
              <span id="new-password-requirement" className="accession-auth-help">At least 6 characters.</span>
            </div>
            <div className="accession-auth-actions">
              <button type="submit" className="accession-auth-primary" disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
          <p role="status" aria-live="polite" className="sr-only">
            {busy ? 'Updating password.' : ''}
          </p>
        </>
      )}
    </AccessionDocument>
  )
}
