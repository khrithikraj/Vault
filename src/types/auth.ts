export type AuthAction =
  | 'sign-in'
  | 'sign-up'
  | 'resend-verification'
  | 'request-recovery'
  | 'update-password'

export type AuthPresentationState =
  | { kind: 'idle' }
  | { kind: 'submitting'; action: AuthAction }
  | { kind: 'verification-pending'; email: string }
  | { kind: 'recovery-sent'; email: string }
  | { kind: 'verified'; email?: string }
  | { kind: 'restored' }
  | { kind: 'link-error'; flow: 'verification' | 'recovery'; message: string }
  | { kind: 'error'; message: string }
