import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'motion/react'
import { FilmGrain } from './FilmGrain'
import { VaultDoor } from './VaultDoor'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { defaultCategorySeeds } from '../lib/defaults'
import './accession/document.css'
import './landing/accession.css'

type LandingPageProps = {
  onGetStarted: () => void
}

type RegisterEntry = {
  title: string
  serial: string
  filedAt: string
}

const STORAGE_KEY = 'vault:landing-register:v1'

const departmentNames = [
  'Gastronomy',
  'Acquisitions',
  'Desiderata',
  'Moving Image',
  'Sacred Architecture',
  'Instruction',
  'Topography',
] as const

const catalogueFixtures = [
  { lot: '014', title: 'The ramen place near the old bookshop', department: 'Gastronomy' },
  { lot: '027', title: 'A walnut reading lamp', department: 'Desiderata' },
  { lot: '041', title: 'In the Mood for Love', department: 'Moving Image' },
  { lot: '058', title: 'The stepwell outside Jaipur', department: 'Topography' },
]

function readStoredEntry(): RegisterEntry | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const entry = JSON.parse(value) as Partial<RegisterEntry>
    if (!entry.title || !entry.serial || !entry.filedAt) return null
    return { title: entry.title, serial: entry.serial, filedAt: entry.filedAt }
  } catch {
    return null
  }
}

function createSerial() {
  const bytes = new Uint8Array(3)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function formatFiledAt(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const reducedMotion = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll()
  const progressScale = useSpring(scrollYProgress, { stiffness: 80, damping: 28, mass: 0.5 })
  const anatomyRef = useRef<HTMLElement>(null)
  const { scrollYProgress: anatomyProgress } = useScroll({
    target: anatomyRef,
    offset: ['start end', 'end start'],
  })
  const anatomyPlateY = useTransform(anatomyProgress, [0.12, 0.42], [48, 0])
  const anatomyPlateScale = useTransform(anatomyProgress, [0.12, 0.42], [0.94, 1])
  const anatomyDetailsY = useTransform(anatomyProgress, [0.3, 0.58], [36, 0])
  const anatomyDetailsOpacity = useTransform(anatomyProgress, [0.3, 0.52], [0.2, 1])
  const [entry, setEntry] = useState<RegisterEntry | null>(() => readStoredEntry())
  const [draft, setDraft] = useState('')
  const [filing, setFiling] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [message, setMessage] = useState(entry ? 'Your saved entry is ready.' : '')
  const leaveTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    },
    [],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = draft.trim()
    if (!title || filing) {
      setMessage('An entry is required.')
      return
    }

    const nextEntry = {
      title,
      serial: createSerial(),
      filedAt: new Date().toISOString(),
    }
    setEntry(nextEntry)
    setFiling(!reducedMotion)
    setMessage('Entry filed as Lot 001.')
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntry))
    } catch {
      setMessage('Entry filed for this visit. Device storage is unavailable.')
    }

  }

  const handleRemove = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // The in-memory register remains usable when device storage is unavailable.
    }
    setEntry(null)
    setDraft('')
    setFiling(false)
    setMessage('Entry removed. The register is ready.')
  }

  const openRegister = () => {
    if (leaving) return
    if (reducedMotion) {
      onGetStarted()
      return
    }
    setLeaving(true)
    leaveTimer.current = window.setTimeout(onGetStarted, 420)
  }

  const [searchQuery, setSearchQuery] = useState('')
  const searchResults = useMemo(() => {
    const records = entry
      ? [{ lot: '001', title: entry.title, department: 'Unclassified' }, ...catalogueFixtures]
      : catalogueFixtures
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return records
    return records.filter((record) =>
      `${record.title} ${record.department} ${record.lot}`.toLocaleLowerCase().includes(query),
    )
  }, [entry, searchQuery])

  return (
    <main className={`accession-shell ${leaving ? 'is-leaving' : ''}`} aria-busy={leaving}>
      <FilmGrain />
      <motion.div
        aria-hidden="true"
        className="accession-progress"
        style={{ scaleY: reducedMotion ? 1 : progressScale }}
      />

      <header className="accession-running-head" aria-label="Catalogue header">
        <span><i aria-hidden="true" />Raj&apos;s Vault — Catalogue 01</span>
        <button type="button" onClick={openRegister} disabled={leaving}>Sign in</button>
      </header>

      <section className="accession-hero" aria-labelledby="accession-title">
        <p className="accession-folio">Frontispiece · 01</p>
        <h1 id="accession-title">
          <span>Everything</span>
          <span>you meant</span>
          <span>to keep.</span>
        </h1>
        <p className="accession-deck">
          A private catalogue for screenshots, links, notes, places, and the things you keep
          meaning to return to.
        </p>

        <AnimatePresence mode="wait" initial={false}>
        {!entry ? (
          <form className="register-form" onSubmit={handleSubmit} noValidate>
            <div className="register-label-row">
              <label htmlFor="register-entry">Lot 001</label>
              <span>{draft.length}/120</span>
            </div>
            <div className="register-input-frame">
              <input
                id="register-entry"
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 120))}
                placeholder="What do you not want to lose?"
                autoComplete="off"
                aria-describedby="register-instructions"
              />
            </div>
            <div className="register-actions">
              <span id="register-instructions">Enter to file</span>
              <button type="submit">File this entry</button>
            </div>
          </form>
        ) : (
          <motion.article
            key="filed-lot"
            className={`accession-lot ${filing ? 'is-filing' : 'is-filed'}`}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.64, ease: [0.65, 0, 0.35, 1] }}
          >
            <div className="lot-heading">
              <span>Lot 001</span>
            </div>
            <div className="lot-content" onAnimationEnd={() => setFiling(false)}>
              <div className="lot-plate" aria-hidden="true">
                <span>Plate 001</span>
                <strong>{entry.title.slice(0, 1)}</strong>
                <small>Object, digital</small>
              </div>
              <motion.div
                className="lot-copy"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.86, duration: 0.32 }}
              >
                <h2>{entry.title}</h2>
                <p className="lot-descriptor">A note, in the hand of the collector.</p>
                <p>Filed {formatFiledAt(entry.filedAt)}.</p>
                <dl>
                  <div><dt>Condition</dt><dd>As found</dd></div>
                  <div><dt>Department</dt><dd>Unclassified</dd></div>
                  <div><dt>Provenance</dt><dd>The collector</dd></div>
                </dl>
                <button type="button" className="lot-remove" onClick={handleRemove}>Remove entry</button>
              </motion.div>
              <aside className="lot-provenance" aria-hidden="true">
                <span>Acquired</span>
                <strong>Direct from collector</strong>
                <span>Rights</span>
                <strong>Private holding</strong>
              </aside>
            </div>
          </motion.article>
        )}
        </AnimatePresence>

        <p className="sr-only" role="status" aria-live="polite">{message}</p>
      </section>

      <motion.section
        className="catalogue-frame conditions-frame"
        aria-labelledby="conditions-title"
      >
        <header className="frame-heading">
          <span>Conditions · 02</span>
          <span>Unfiled</span>
        </header>
        <div className="condition-composition">
          <p id="conditions-title">
            An unfiled thing has no lot number, no date, and no location. It is not lost. It is
            simply unaccounted for.
          </p>
          <div className="unfiled-plate" aria-label="An unfiled screenshot">
            <span>Untitled object</span>
            <strong>?</strong>
            <small>Provisional · origin unknown</small>
          </div>
        </div>
      </motion.section>

      <motion.section
        ref={anatomyRef}
        className="catalogue-frame anatomy-frame"
        aria-labelledby="anatomy-title"
      >
        <header className="frame-heading">
          <span>Lot apparatus · 02</span>
          <span>f. 02</span>
        </header>
        <div className="frame-statement">
          <p>The anatomy of a lot</p>
          <h2 id="anatomy-title">A loose thought becomes an object with a place.</h2>
        </div>
        <div className="anatomy-object">
          <motion.figure
            className="anatomy-plate"
            style={reducedMotion ? undefined : { y: anatomyPlateY, scale: anatomyPlateScale }}
          >
            <span>Plate 002</span>
            <img
              src="/plates/ramen.webp"
              alt="A bowl of ramen presented as a saved food discovery"
              width="700"
              height="875"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Food study, colour · 700 × 875 px</figcaption>
          </motion.figure>
          <motion.ol
            aria-label="Parts of a filed entry"
            style={reducedMotion ? undefined : { y: anatomyDetailsY, opacity: anatomyDetailsOpacity }}
          >
            <li><span>01</span><strong>Title</strong><small>The thing as you remember it</small></li>
            <li><span>02</span><strong>Serial</strong><small>Assigned automatically</small></li>
            <li><span>03</span><strong>Department</strong><small>Its permanent place</small></li>
            <li><span>04</span><strong>Provenance</strong><small>Where it came from</small></li>
          </motion.ol>
        </div>
      </motion.section>

      <section className="catalogue-frame departments-frame" aria-labelledby="departments-title">
        <header className="frame-heading">
          <span>Departments · 03</span>
          <span>Seven appointed</span>
        </header>
        <div className="frame-statement">
          <p>The index</p>
          <h2 id="departments-title">Seven departments. Or as many as you appoint.</h2>
        </div>
        <div className="department-register">
          {defaultCategorySeeds.map((category, index) => (
            <details key={category.name} style={{ '--department-color': category.color } as React.CSSProperties}>
              <summary>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{departmentNames[index]}</strong>
                <i aria-hidden="true" />
                <b>{String(category.field_schema.length).padStart(2, '0')}</b>
                <small>{category.name}</small>
              </summary>
              <p>{category.field_schema.map((field) => field.label).join(' · ')}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="catalogue-frame recall-frame" aria-labelledby="recall-title">
        <header className="frame-heading">
          <span>Recall · 04</span>
          <span>{searchResults.length} {searchResults.length === 1 ? 'lot' : 'lots'} found</span>
        </header>
        <div className="frame-statement">
          <p>The retrieval</p>
          <h2 id="recall-title">An index is only worth the speed of its retrieval.</h2>
        </div>
        <form className="catalogue-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="catalogue-search">Search the catalogue</label>
          <input
            id="catalogue-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Try “ramen”, “lamp”, or “Jaipur”"
            autoComplete="off"
          />
        </form>
        <p className="sr-only" role="status" aria-live="polite">
          {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found.
        </p>
        <div className="search-ledger">
          {searchResults.length ? searchResults.map((result) => (
            <article key={result.lot} className={result.lot === '027' ? 'has-plate' : undefined}>
              <span>Lot {result.lot}</span>
              <h3>{result.title}</h3>
              <i aria-hidden="true" />
              <small>{result.department}</small>
              {result.lot === '027' ? (
                <img
                  src="/plates/lamp.webp"
                  alt="A walnut reading lamp from the catalogue"
                  width="667"
                  height="1000"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </article>
          )) : <p>No lot answers that description.</p>}
        </div>
      </section>

      <section className="catalogue-frame reserve-frame" aria-labelledby="reserve-title">
        <header className="frame-heading">
          <span>The reserve · 06</span>
          <span>Private by default</span>
        </header>
        <div className="reserve-copy">
          <p>Terms of custody</p>
          <h2 id="reserve-title">Yours. Sealed. Quiet.</h2>
          <p>
            Your catalogue is private by default. A single lot may be released by link, at your
            instruction. Nothing else travels.
          </p>
        </div>
        <div className="reserve-door"><VaultDoor variant="void" /></div>
      </section>

      <section className="catalogue-frame invitation-frame" aria-labelledby="invitation-title">
        <header className="frame-heading">
          <span>The invitation · 07</span>
          <span>Private by default</span>
        </header>
        <div>
          <p>Catalogue 01</p>
          <h2 id="invitation-title">Begin with one thing you don&apos;t want to lose.</h2>
          <button type="button" onClick={openRegister} disabled={leaving}>Open the register</button>
          <figure className="invitation-plate">
            <img
              src="/plates/place.webp"
              alt="The Taj Mahal preserved as a place to revisit"
              width="800"
              height="800"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Plate 003 · Architectural study, colour</figcaption>
          </figure>
        </div>
      </section>

      <footer className="accession-first-footer">
        <span>Filed privately on this device</span>
        <span>Instrument Serif · Space Grotesk · Inter</span>
        <span>f. 07</span>
      </footer>
    </main>
  )
}
