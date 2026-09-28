import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Category } from '../../types/app'
import { reducedMotion } from '../../design/motion'
import { FilmGrain } from '../FilmGrain'
import { ScrollProgress } from '../ScrollProgress'
import { VaultPage } from '../ui/VaultPage'
import { HomeCanvas } from './HomeCanvas'

type AuthenticatedShellProps = {
  activeCategory?: Category | null
  children: ReactNode
}

type AuthenticatedPublicationProps = {
  identity: ReactNode
  /** Status capsule, rendered inside the header wrapper beneath the identity. */
  capsule?: ReactNode
  status: ReactNode
  search: ReactNode
  children: ReactNode
}

export function AuthenticatedShell({ activeCategory, children }: AuthenticatedShellProps) {
  return (
    <main className="relative min-h-screen pb-36">
      <HomeCanvas activeCategory={activeCategory} />
      <FilmGrain />
      <ScrollProgress />
      {children}
    </main>
  )
}

/**
 * The signed-in publication: one Vault header, then the scrolling catalogue.
 *
 * The header — identity row, status capsule, search field — is ordinary
 * document content. `.vault-chrome` is a plain block-level child of
 * `.vault-page`: it is not `position: fixed` and not `position: sticky`, it
 * takes its width and centring from the page, and it contributes its own height
 * to the layout. Nothing reserves a band for it, so the page reads as
 * header + spacing + content, and the browser's own page scroll carries the
 * header away with the catalogue — at `scrollY = 0` all three pieces are
 * visible, a few hundred pixels down they have travelled with everything else,
 * and at maximum scroll the header has simply scrolled out of the viewport
 * because it was never pinned there in the first place. Scroll back up and it
 * returns, exactly like any other content.
 *
 * The three pieces are siblings inside one wrapper so they cannot drift apart
 * from one another or detach individually. None of them positions itself.
 */
export function AuthenticatedPublication({
  identity,
  capsule,
  status,
  search,
  children,
}: AuthenticatedPublicationProps) {
  return (
    <VaultPage>
      <div className="vault-chrome">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion({ duration: 0.5, ease: 'easeOut' })}
          className="relative"
        >
          {identity}
        </motion.div>

        {capsule}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion({ duration: 0.45, ease: 'easeOut', delay: 0.06 })}
          className="mt-8 sm:mt-10"
          data-tour="search"
        >
          {search}
        </motion.div>
      </div>

      {status}

      {children}
    </VaultPage>
  )
}
