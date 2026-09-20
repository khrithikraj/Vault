import { FilmGrain } from '../FilmGrain'
import './document.css'

type AccessionLoadingDocumentProps = {
  frame?: string
  folio?: string
  title?: string
}

export function AccessionLoadingDocument({
  frame = 'Sign in · 10',
  folio = 'Sign in',
  title = 'Loading…',
}: AccessionLoadingDocumentProps) {
  return (
    <main className="accession-shell" aria-label="Loading sign-in">
      <FilmGrain />
      <header className="accession-running-head" aria-label="Page header">
        <span><i aria-hidden="true" />Raj&apos;s Vault — Catalogue 01</span>
        <span>{frame}</span>
      </header>
      <section className="catalogue-frame">
        <header className="frame-heading">
          <span>{frame}</span>
          <span>Loading</span>
        </header>
        <div className="frame-statement accession-loading-statement">
          <p>{folio}</p>
          <h1>{title}</h1>
        </div>
        <p className="sr-only" role="status" aria-live="polite">Loading sign-in.</p>
      </section>
    </main>
  )
}
