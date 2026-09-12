import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Category } from '../../types/app'
import { FilmGrain } from '../FilmGrain'
import { ProgressiveBlur } from '../ProgressiveBlur'
import { ScrollProgress } from '../ScrollProgress'
import { VaultPage } from '../ui/VaultPage'
import { HomeCanvas } from './HomeCanvas'

type AuthenticatedShellProps = {
  activeCategory?: Category | null
  children: ReactNode
}

type AuthenticatedPublicationProps = {
  identity: ReactNode
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
      <ProgressiveBlur side="bottom" height={140} />
      {children}
    </main>
  )
}

export function AuthenticatedPublication({
  identity,
  status,
  search,
  children,
}: AuthenticatedPublicationProps) {
  return (
    <VaultPage>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative"
      >
        {identity}
      </motion.div>

      {status}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.06 }}
        className="mt-8 sm:mt-10"
        data-tour="search"
      >
        {search}
      </motion.div>

      {children}
    </VaultPage>
  )
}