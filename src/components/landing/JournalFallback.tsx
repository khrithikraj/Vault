import { NotebookPen } from 'lucide-react'
import { AmbientBackground } from '../AmbientBackground'
import { ScrollReveal } from '../ScrollReveal'
import { BrandIcon } from '../../lib/icons'
import { JOURNAL_PAGES } from './storyboard'

type JournalFallbackProps = {
  onGetStarted: () => void
}

/** Reduced-motion fallback: the same story beats as `CameraScene`, laid out as plain scrolling
 * sections with simple fades — no pinning, no simulated camera, no idle drift loops. */
export function JournalFallback({ onGetStarted }: JournalFallbackProps) {
  return (
    <main className="relative">
      <AmbientBackground />

      <button
        type="button"
        onClick={onGetStarted}
        className="term-chip fixed right-4 top-4 z-20 rounded-full px-4 py-2 text-sm font-medium uppercase tracking-wide"
      >
        Sign in
      </button>

      <section className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Raj&apos;s</p>
        <h1 className="max-w-sm text-3xl font-bold uppercase leading-[0.95] tracking-tight">
          Your life, saved beautifully.
        </h1>
        <div
          className="flex h-32 w-24 items-center justify-center rounded-md"
          style={{ background: 'linear-gradient(165deg, #382416 0%, #1c1006 55%, #100904 100%)' }}
        >
          <BrandIcon icon={NotebookPen} size={30} />
        </div>
      </section>

      {JOURNAL_PAGES.map((page) => (
        <ScrollReveal key={page.title} className="flex min-h-screen items-center justify-center px-4">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ border: '1px solid var(--surface-border)' }}
            >
              <BrandIcon icon={page.icon} size={28} />
            </div>
            <h2 className="text-2xl font-bold uppercase tracking-tight">{page.title}</h2>
            <p className="text-sm leading-relaxed text-ink-soft">{page.body}</p>
          </div>
        </ScrollReveal>
      ))}

      <ScrollReveal className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight sm:text-3xl">
          Ready when you are.
        </h2>
        <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
          Sign in to sync everything across your devices — or try it without an account.
        </p>
        <button
          type="button"
          onClick={onGetStarted}
          className="term-btn-primary rounded-full px-6 py-3.5 text-sm font-semibold uppercase tracking-widest"
        >
          Get started
        </button>
      </ScrollReveal>
    </main>
  )
}
