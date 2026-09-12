import { useEffect, useState } from 'react'

const STORAGE_KEY = 'vault:onboardingSeen'

/**
 * Tracks whether the first-run onboarding coachmark has been shown.
 * Fires once per device (localStorage flag) shortly after the vault becomes
 * usable (real sign-in or dev preview) — never during auth/landing screens.
 */
export function useOnboardingTour(enabled: boolean) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }
    let seen = false
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      seen = false
    }
    if (seen) {
      return
    }
    const timer = window.setTimeout(() => setActive(true), 650)
    return () => window.clearTimeout(timer)
  }, [enabled])

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore storage errors (private browsing, quota, etc.) — worst case the
      // tour reappears next visit, which is harmless.
    }
    setActive(false)
  }

  const restart = () => setActive(true)

  return { active, finish, restart }
}
