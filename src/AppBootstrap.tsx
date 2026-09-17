import { lazy, Suspense, useState } from 'react'
import { LandingPage } from './components/LandingPage'
import { AccessionLoadingDocument } from './components/accession/AccessionLoadingDocument'

const VaultApp = lazy(() => import('./App'))

function shouldOpenVaultImmediately() {
  const url = new URL(window.location.href)
  const isAppRoute = url.pathname.startsWith('/s/') || url.searchParams.has('shared')
  const isAuthCallback = url.searchParams.has('code') || url.hash.includes('type=recovery') || url.hash.includes('error=')
  let hasStoredSession = false
  try {
    hasStoredSession = Object.keys(window.localStorage).some(
      (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
    )
  } catch {
    hasStoredSession = false
  }

  return isAppRoute || isAuthCallback || hasStoredSession
}

export function AppBootstrap() {
  const [vaultRequested, setVaultRequested] = useState(shouldOpenVaultImmediately)

  if (!vaultRequested) {
    return <LandingPage onGetStarted={() => setVaultRequested(true)} />
  }

  return (
    <Suspense fallback={<AccessionLoadingDocument />}>
      <VaultApp onReturnToLanding={() => setVaultRequested(false)} />
    </Suspense>
  )
}
