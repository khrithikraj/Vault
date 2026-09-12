import type { ReactNode, Ref } from 'react'
import { FilmGrain } from '../FilmGrain'
import './document.css'
import './auth.css'

type AccessionDocumentProps = {
  frame: string
  status: string
  folio: string
  title: string
  titleRef?: Ref<HTMLHeadingElement>
  ruleState?: 'provisional' | 'solid'
  plate?: boolean
  marginalia?: string
  children?: ReactNode
  footer?: ReactNode
}

export function AccessionDocument({
  frame,
  status,
  folio,
  title,
  titleRef,
  ruleState = 'provisional',
  plate = false,
  marginalia,
  children,
  footer,
}: AccessionDocumentProps) {
  return (
    <main className={`accession-shell accession-auth is-${ruleState}`}>
      <FilmGrain />
      <header className="accession-running-head" aria-label="Page header">
        <span><i aria-hidden="true" />Raj&apos;s Vault — Accession 01</span>
        <span>{frame}</span>
      </header>

      <section className="accession-auth-frame" aria-labelledby="accession-auth-title">
        <header className="frame-heading">
          <span>{frame}</span>
          <span>{status}</span>
        </header>

        <div className="accession-auth-layout">
          <p className="accession-auth-folio">{folio}</p>
          {plate ? (
            <figure className="accession-auth-plate" aria-hidden="true">
              <span>Plate 004</span>
              <strong>A</strong>
              <figcaption>Sign-in · private by default</figcaption>
            </figure>
          ) : null}
          <div className="accession-auth-content">
            <h1 id="accession-auth-title" ref={titleRef} tabIndex={-1}>{title}</h1>
            {children}
          </div>
          {marginalia ? <aside className="accession-auth-marginalia">{marginalia}</aside> : null}
        </div>
      </section>

      <footer className="accession-first-footer">
        <span>Private account</span>
        <span>{footer}</span>
        <span>f. {frame.match(/\d+/)?.[0] ?? '10'}</span>
      </footer>
    </main>
  )
}
