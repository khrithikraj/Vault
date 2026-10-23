# Raj's Vault — Typography Audit

**Audit type:** read-only source and CSS inspection
**Baseline:** `main` @ `200771d` plus the current uncommitted working tree
**Date:** 2026-10-22
**Report path:** `docs/audits/typography-audit.md`

---

## 1. Executive summary

| Measure | Result |
| --- | --- |
| TSX files inspected | 77 / 77 |
| Stylesheets inspected | 5 / 5 |
| TS files scanned for type-related strings | 33 / 33 |
| Screen/feature areas covered | 13 |
| Confirmed typography issues | 16 |
| Issues requiring visual/device verification | 8 |
| Dominant body face | Inter |
| Dominant structural voice | Space Grotesk (uppercase labels/headings) |
| Distinct font-family systems in use | 6 (Inter, Space Grotesk, Instrument Serif, system UI, system mono, Android system faces) |

**Top three findings**

1. **Cascade conflicts silently neutralize typography utilities.** `.vault-meta` and `.vault-action` are emitted after Tailwind's generated utilities, so they override size, weight, tracking, case, and colour on the same element. Examples: every `VaultButton` size resolves to a 13px/600 label regardless of `size` (`src/components/ui/VaultButton.tsx:29-33`, `src/styles/global.css:486-492`), and classes such as `vault-meta text-ink-soft/55` or `vault-meta text-[9px]` do not produce the requested colour or size (`src/components/ui/VaultEmptyState.tsx:28`, `src/components/home/ArchiveIdentity.tsx:62`).
2. **Two incompatible heading systems coexist.** Editorial serif headings (`.vault-section-title`, Instrument Serif, 24–32px, sentence case) compete with uppercase Space Grotesk headings (`.vault-heading`, 14px, 0.2em tracking) for the same semantic level. Heading levels are also visually inverted: `h2` can be 14px while `h3` is 20–32px.
3. **Micro-label sprawl.** The same eyebrow/meta role is set at 9, 10, 11, 12, 13, and 14px, with at least ten tracking values (`0.025em`–`0.28em`) and both 600 and 700 weights. `--text-xs` is redefined to 13px but keeps the line-height computed for 12px, producing a 13px/17.33px pairing.

No production code, styles, config, tests, assets, dependencies, or Git state were changed. Only this report file was created.

---

## 2. Scope and coverage

### Inspected

- All 77 `.tsx` files under `src`, including 73 components.
- `src/App.tsx` (1,457 lines), `src/main.tsx`, `src/AppBootstrap.tsx`.
- All five stylesheets: `src/styles/global.css` (997 lines), `src/styles/token.css` (206), `src/components/landing/accession.css` (1,028), `src/components/accession/auth.css` (311), `src/components/accession/document.css` (192).
- `index.html` (font preload and document metadata).
- Android shell: `MainActivity.java`, `AlarmActivity.java`, `res/values/styles.xml`, `res/layout/activity_main.xml`.
- Existing built bundle `dist/assets/index-g9iWv6JL.css` to verify actual cascade order and variable resolution.
- Font assets in `public/fonts/` and the synced Android copies.

### Not performed

- No dev server, browser session, screenshot capture, or Playwright run.
- No Android emulator or physical-device session.
- No automated contrast, font-metric, or line-box measurement.
- No build, lint, test, or dependency command that would mutate the workspace.

### Exclusions

- Logic-only `.ts` files were scanned for typography strings but not reviewed line by line.
- Icon components and decorative SVG geometry are excluded unless they contain text.

---

## 3. Current font-family inventory

| Family | Declared | Weights | Assets | Primary role | Evidence |
| --- | --- | --- | --- | --- | --- |
| Inter | `--font-body` | Variable 400–800 | `public/fonts/inter-latin.woff2` | Default body, inputs, metadata, some labels | `src/styles/global.css:20-26,63-69`; `src/styles/token.css:49,88` |
| Space Grotesk | `--font-display` | Variable 400–700 | `public/fonts/space-grotesk-latin.woff2` | Uppercase headings, folios, labels, buttons | `src/styles/global.css:28-34`; `src/styles/token.css:48,87`; 39 `font-display` class usages |
| Instrument Serif | `--font-accession-serif` | 400 normal + 400 italic | `instrument-serif-regular-latin.woff2`, `instrument-serif-italic-latin.woff2` | Landing/auth/document display headings, editorial statements | `src/styles/global.css:4-18`; `src/styles/token.css:50`; 22 CSS references |
| System UI | Tailwind default `--font-sans` | Platform | None | Two OCR fallback paragraphs only | `src/components/CaptureFab.tsx:688,992` |
| System mono | Tailwind default `--font-mono` | Platform | None | Time pickers, hex colour, OCR transcript, reminder time | 13–14 `font-mono` class usages across 6 files |
| Android system faces | `sans-serif-medium`, `sans-serif-light`, `serif` | Synthetic bold/italic | None | Native alarm/reminder screen | `android/app/src/main/java/com/khrithikraj/vault/alarm/AlarmActivity.java:232-407` |

**Confirmed family split:** `font-sans` is not a synonym for Inter. `--font-sans` is never overridden in `token.css`, so `font-sans` resolves to the platform UI stack, while `body` uses Inter. `font-mono` is never declared at all.

**Android split:** the native alarm screen does not load or reference Inter, Space Grotesk, or Instrument Serif. It uses `Typeface.create("sans-serif-medium", Typeface.BOLD)`, `Typeface.create("sans-serif-light", Typeface.BOLD)`, `Typeface.create("serif", Typeface.BOLD)`, and `Typeface.create("serif", Typeface.ITALIC)`. The 46sp clock at `AlarmActivity.java:267-269` asks for a light face and then applies synthetic bold.

---

## 4. Current typography-token inventory

### Semantic sizes (`src/styles/token.css:123-134`)

| Token | Source value | Resolved | Paired line-height | Status |
| --- | --- | --- | --- | --- |
| `--text-2xs` | `0.6875rem` | 11px | None | Used only through `var()` |
| `--text-micro` | `0.75rem` | 12px | None | One utility usage plus `.text-micro` |
| `--text-xs` | `0.8125rem` | 13px | `17.33px` (Tailwind `calc(1 / .75)`) | **Mismatched pair** |
| `--text-sm` | `0.875rem` | 14px | 20px | Tailwind pair retained |
| `--text-base` | `1rem` | 16px | 24px | Tailwind pair retained |
| `--text-lg` | `1.125rem` | 18px | 28px | Tailwind pair retained |
| `--text-xl` | `1.25rem` | 20px | 28px | Tailwind pair retained |
| `--text-heading` | `2.5625rem` | 41px | None | **Defined but unused** |
| `--text-display` | `clamp(2.5rem, 7vw, 5rem)` | 40–80px | `--leading-display` in role classes | Token used only by unused classes |

### Line-height

| Token | Value | Usage |
| --- | --- | --- |
| `--leading-display` | `0.9` | `.text-display`, `.vault-display`, `.vault-wordmark` |
| `--leading-tight` | `1.15` (runtime) | `.leading-tight` utility; built theme first emits `1.25`, later `:root` emits `1.15` |
| `--leading-normal` | `1.5` | `.vault-body` only |
| Tailwind `leading-none` | `1` | 3 usages |
| Tailwind `leading-tight` | `1.15` final | 6 usages |
| Tailwind `leading-snug` | `1.375` | 7 usages |
| Tailwind `leading-relaxed` | `1.625` | 13 usages |
| Arbitrary | `0.9`, `1.1` | `ArchiveIdentity.tsx:53`, `ArchiveObject.tsx:151` |

### Families

- `--font-display` and `--font-body` are declared twice, once in `@theme` and once in `:root` (`token.css:47-50,87-88`).
- `--font-accession-serif` exists only in `@theme`.
- No `--font-mono`, no `--font-sans`, no paired weight/tracking tokens.

### CSS size expressions

The four typography stylesheets contain **34 distinct `font-size` declarations**: 18 fixed values and 16 `clamp()` expressions. Fixed values range from `0.625rem` (10px) to `2.25rem` (36px). TSX adds `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[0.95rem]`, `text-[1.05rem]`, `text-[1.3rem]`, `text-[1.55rem]`, and the standard Tailwind scale on top of that.

---

## 5. Typography role matrix

| Role | Current implementation | Observed sizes | Weight / tracking / case | Assessment |
| --- | --- | --- | --- | --- |
| Marketing hero | `.accession-hero h1` serif | `clamp(4rem, 8.4vw, 7.75rem)` desktop; `clamp(2.75rem, 13vw, 4rem)` mobile | 400 / -0.025em / sentence case | Distinctive but isolated from app type scale |
| Auth/page hero | `.accession-auth-content h1`, `.frame-statement h2` | `clamp(2.75rem, 4.4vw, 4.25rem)`, `clamp(3rem, 5.2vw, 5rem)` | 400 / -0.02em / sentence case | Different clamp per surface for same role |
| App masthead H1 | `ArchiveIdentity.tsx:52-61` | 1.3rem → 1.6rem | 600 / 0.08em / uppercase | Smaller than many card H3s |
| Page/section H2 | `.vault-section-title` serif | `clamp(1.5rem, 3vw, 2rem)` | 400 / normal / sentence case | Competes with uppercase system |
| Dialog H2 | `.vault-heading` | 14px (`--text-sm`) | 600 / 0.2em / uppercase | Smaller than body text |
| Nested group H3 | `SearchResults.tsx:40,88,108`; `App.tsx:1175-1209` | 13–14px | 600 / 0.2em / uppercase | Smaller than card H3s |
| Card title H3 | `ArchiveObject.tsx:150-153`, `NoteCard.tsx:54`, `DocumentCard.tsx:63` | 15.2–29.6px | 600 / tight / mixed case policy | Same semantic level, 2× size range |
| Eyebrow/folio | `.folio`, `.text-micro`, `.vault-section-folio`, `.vault-meta` | 9–13px | 500–600 / 0.08–0.28em / uppercase | Four competing roles |
| Body | Inherited Inter | 14–17px | 400 / normal | No single body role |
| Form label | `.vault-label` (unused); utility stacks | 13px | 600 / 0.02em vs 0.1em | Two implementations |
| Button/action | `.vault-action` | 13px final | 600 / 0.08em / uppercase | Overrides all `VaultButton` sizes |
| Monospace/data | System mono | 10–24px | 700 in most places | Undeclared family |
| Numerals | `tabular-nums` in some places | — | — | Applied inconsistently |

---

## 6. Screen/component coverage matrix

| Area | Primary files | Source coverage | Visual verification |
| --- | --- | --- | --- |
| Landing / catalogue marketing | `LandingPage.tsx`, `landing/accession.css`, `accession/document.css` | Full | Not run |
| Auth / admission | `AuthScreen.tsx`, `UpdatePasswordScreen.tsx`, `AccessionDocument.tsx`, `AccessionLoadingDocument.tsx`, `accession/auth.css`, `VaultDoor.tsx` | Full | Not run |
| Home shell / catalogue | `App.tsx`, `AuthenticatedShell.tsx`, `ArchiveIdentity.tsx`, `VaultStatusCapsule.tsx`, `CommandSearch.tsx`, `FloatingNav.tsx`, `DynamicIsland.tsx`, `HomeCanvas.tsx`, `CategoryIndex.tsx`, `ArchiveObject(s).tsx` | Full | Not run |
| Item detail | `ItemDetailOverlay.tsx`, `ItemIdentitySection.tsx`, `ItemPhotoSection.tsx`, `FoodSpotBranches.tsx`, `FieldQuickActions.tsx`, `MoreActionsMenu.tsx`, `DoneStamp.tsx`, `CompletionControl.tsx`, `CopyButton.tsx`, `ShareStatusPanel.tsx`, `StarRating.tsx`, `FavoriteButton.tsx` | Full | Not run |
| Notes | `NotesPanel.tsx`, `NoteCard.tsx`, `NoteEditor.tsx`, `NoteDetailOverlay.tsx`, `NoteReminderControl.tsx`, `ReminderControl.tsx` | Full | Not run |
| Capture flow | `CaptureFab.tsx`, `CategoryEditor.tsx`, `AddMenu.tsx`, `VaultSelect.tsx`, `CustomDatePicker.tsx`, `CustomTimePicker.tsx`, `TimeWheel.tsx` | Full (typography surfaces) | Not run |
| Reminders | `RemindersPanel.tsx`, `ReminderEditorDialog.tsx`, `AlarmToneCard.tsx` | Full | Not run |
| Documents | `DocumentsPanel.tsx`, `DocumentCard.tsx`, `DocumentUploader.tsx`, `DocumentEditDialog.tsx`, `DocumentViewer.tsx`, `PdfCanvasViewer.tsx` | Full | Not run |
| Search / trash / confirm | `SearchResults.tsx`, `TrashPanel.tsx`, `ConfirmDialog.tsx` | Full | Not run |
| Account / onboarding | `AccountPanel.tsx`, `OnboardingTour.tsx` | Full | Not run |
| Shared item | `SharedItemView.tsx` | Full | Not run |
| Empty/loading/error | `VaultEmptyState.tsx`, `VaultSkeleton.tsx`, `VaultPage.tsx`, `ErrorBoundary.tsx` | Full | Not run |
| Android alarm | `AlarmActivity.java`, `styles.xml`, `activity_main.xml` | Full source | Not run |

---

## 7. Confirmed inconsistencies

### T-01 — `--text-xs` size and line-height disagree

`token.css:125` changes `--text-xs` from Tailwind's `0.75rem` to `0.8125rem` (13px), but the built theme still pairs it with `--text-xs--line-height: calc(1 / .75)` (1.3333). Every `.text-xs` therefore renders 13px on a 17.33px line box computed for 12px.

Evidence: `src/styles/token.css:125`; built theme declaration in `dist/assets/index-g9iWv6JL.css`; `.text-xs` utility definition.

### T-02 — `.vault-meta` overrides its own utility modifiers

`.vault-meta` is emitted at byte offset ~82,738 in the built stylesheet, after all Tailwind size, tracking, weight, and colour utilities (for example `text-[9px]` at ~57,835, `tracking-[0.2em]` at ~58,867, `text-ink-soft/55` at ~61,854). Because the selectors have equal specificity and share the utilities layer, `.vault-meta` wins:

- `vault-meta text-ink-soft/55` renders full `#7a6e60`, not 55% opacity.
- `vault-meta text-[9px] tracking-[0.18em]` renders 11px with `0.08em` tracking.
- `vault-meta font-display text-[10px] font-semibold` loses the size, weight, and tracking changes.

Evidence: `src/styles/global.css:475-483`; `ArchiveIdentity.tsx:62`; `VaultStatusCapsule.tsx:40-52`; `ItemIdentitySection.tsx:40`; `ItemDetailOverlay.tsx:354,409`; `VaultEmptyState.tsx:28`; `AccountPanel.tsx:97`; `App.tsx:1107,1131`; built CSS ordering.

### T-03 — `.vault-action` neutralizes every `VaultButton` size

`VaultButton` applies `text-xs`/`text-sm`/`text-base` by size and `font-medium`, but `.vault-action` is emitted after those utilities and sets `font-size: var(--text-xs)` (13px), `font-weight: 600`, `letter-spacing: .08em`, and uppercase. Every button size therefore shares one font size and one weight; only the line-height and padding still differ.

Evidence: `src/components/ui/VaultButton.tsx:29-33,42-47`; `src/styles/global.css:485-492`; built CSS offsets `.text-*` ~57k vs `.vault-action` ~82.9k.

### T-04 — Two competing heading systems

- **Serif system:** `.vault-section-title` — Instrument Serif, `clamp(1.5rem, 3vw, 2rem)`, weight 400, sentence case, line-height 1 (`global.css:531-539`), rendered by `VaultSection.tsx:31`.
- **Grotesk system:** `.vault-heading` — Space Grotesk, 14px, weight 600, uppercase, 0.2em tracking (`global.css:449-456`), rendered by `VaultTypography.tsx:16` through `VaultDialog.tsx:226`.

Both are `h2` elements. The dialog heading is visually a micro-label; the section heading is an editorial title.

### T-05 — Semantic heading levels are visually inverted

Examples of the same level carrying unrelated sizes:

- `h2` at 14px: `SearchResults.tsx:88,108`; `VaultDialog.tsx:226`.
- `h2` at 20–32px: `ItemIdentitySection.tsx:76`; `vault-section-title`.
- `h3` at 13px: `RemindersPanel.tsx:230`; `ItemIdentitySection.tsx:40`.
- `h3` at 24–32px: `CaptureFab.tsx:766,818`; `AccountPanel.tsx:99`.
- `h4` at 10px: `AccountPanel.tsx:112,174,206`.

A dialog `h2` is smaller than the 16px body, and a nested `h3` can be more than twice the size of its parent `h2`.

### T-06 — The micro-label role spans 9–14px

Observed counts: `text-[9px]` 21, `text-[10px]` 50, `text-[11px]` 17, `text-micro` (12px) 1, `text-xs` (13px) 140, `text-sm` (14px) 88. Labels that all read as “small uppercase metadata” use six different sizes with no documented rule.

### T-07 — Tracking spans `0.025em`–`0.28em`

Same-role examples:

- `.vault-meta`: `0.08em` (`global.css:480`)
- `.vault-action`: `0.08em` (`global.css:491`)
- `.text-micro`: `0.18em` (`global.css:423`)
- `.vault-section-folio`: `0.18em` (`global.css:528`)
- `.vault-heading`: `0.2em` (`global.css:455`)
- `.folio`: `0.22em` (`global.css:430`)
- Auth/document labels: `0.14em`, `0.16em`, `0.2em` (`auth.css:35,53,107,188,228`; `document.css:31,67,86,145,173`)
- App labels: `0.12em`, `0.14em`, `0.18em`, `0.2em`, `0.22em`, `0.25em`, `0.28em`
- Tailwind `tracking-wide` (`0.025em`) is mixed into uppercase labels despite being visually near-zero.

At small sizes, the difference between `0.18em` and `0.2em` is invisible, while `0.025em` versus `0.28em` is a different design language.

### T-08 — Weight split for the same role

Uppercase structural text uses 500, 600, and 700 for equivalent hierarchy:

- 500: `.vault-meta`, `.vault-wordmark`, `.home-watermark`, body default.
- 600: `.vault-heading`, `.folio`, `.text-micro`, `.vault-action`, `.vault-section-folio`, auth/document labels.
- 700: `CaptureFab.tsx:536,599,766,818`; `AccountPanel.tsx:99`; `ErrorBoundary.tsx:38`; `DoneStamp.tsx:26`; `CompletionControl.tsx` uses 600 for a similar stamp.

### T-09 — `font-mono` is an undeclared family

The app uses `font-mono` 13–14 times but never defines `--font-mono` or a monospace `@font-face`. It resolves to Tailwind's platform stack (`ui-monospace, SFMono-Regular, Menlo, ...`), which differs across Windows, Android, and desktop browsers.

Evidence: `NoteEditor.tsx:366,629`; `CaptureFab.tsx:682,986`; `CategoryEditor.tsx:302`; `ReminderControl.tsx:360`; `CustomTimePicker.tsx:313,347,363,388,552,618,652`; `TimeWheel.tsx:428`.

### T-10 — `font-sans` is not Inter

`CaptureFab.tsx:688` and `:992` use `font-sans text-sm` for the “No readable text found” OCR message. `--font-sans` is never mapped to Inter, so these two paragraphs render in the platform UI font while surrounding body copy renders in Inter.

### T-11 — Input typography has three different scales

- `VaultInput` / `VaultTextarea`: 14px (`VaultInput.tsx:21,43`).
- Auth input: 16px (`auth.css:132`).
- Landing register input: `clamp(1.125rem, 2vw, 1.35rem)` (18–21.6px) (`landing/accession.css:120`).
- Capture step inputs override to 18px (`CaptureFab.tsx:784,802`).

### T-12 — Android native typography is a separate system

`AlarmActivity.java` builds text programmatically with Android faces only: 11sp wordmark at 0.22 letter spacing, 9.5sp status pill at 0.14, 46sp clock with synthetic bold, 14sp italic `serif` date, 21sp bold `serif` title, 14sp/13sp/12sp buttons. The web brand faces are absent, and several faces are synthetically emboldened because the family has no bold weight.

### T-13 — Font loading is asymmetric

Only Instrument Serif regular is preloaded (`index.html:30-36`). Inter, Space Grotesk, and Instrument Serif italic are not. All faces use `font-display: swap` (`global.css:8,16,24,32`), so first paint can show the fallback face for the majority of UI text.

### T-14 — 9px and 10px type is common

21 usages of `text-[9px]` and 50 of `text-[10px]`. Examples: `ArchiveIdentity.tsx:62,93`; `ArchiveObject.tsx:104,113,161,191`; `CategoryIndex.tsx:81,259`; `CommandSearch.tsx:118`; `FloatingNav.tsx:271`; `VaultStatusCapsule.tsx:42,52`; `CustomTimePicker.tsx:358,399`; `TimeWheel.tsx:491`; `CompletionControl.tsx:31`; `NoteEditor.tsx:644`. These are below common mobile legibility thresholds, especially with wide tracking and low-opacity ink.

### T-15 — Page-title weights are inconsistent

`ArchiveIdentity` masthead is 600; `ErrorBoundary` and `AccountPanel` identities are 700; `SharedItemView` uses 700 for the error state and 600 for the item title; `CaptureFab` step titles are 700. The same “page/showcase title” role has no single weight.

### T-16 — Tabular numerals are inconsistent

`tabular-nums` appears in `VaultStatusCapsule.tsx:40,50`, `RemindersPanel.tsx:234`, and `TimeWheel` numeral rows, but not in `CustomTimePicker` digits, reminder times, counts in `App.tsx`, or document metadata. Numeric columns can shift when values change.

---

## 8. Possible issues requiring visual verification

1. **FOUT/FOIT perception:** With `swap` on every face and only one preload, the first render may show system fallback for body and headings. The visual severity is unmeasured.
2. **9–11px uppercase labels at 360px:** Source inspection cannot confirm whether these are legible on a 360×800 device, particularly at `ink-soft/35`–`/60` opacities.
3. **Instrument Serif clipping:** Line heights of `0.88`–`0.98` on 40–124px display type may clip ascenders/descenders in Android WebView. Requires rendering at the target sizes.
4. **User-content uppercasing:** Card titles and item titles are uppercased in `ArchiveObject.tsx`, `NoteCard.tsx`, `DocumentCard.tsx`, `RemindersPanel.tsx`, and `ItemIdentitySection.tsx`. This may be intentional, but it changes user-entered casing and can increase wrap length; needs design confirmation.
5. **`text-wrap: balance` scope:** Applied to display/serif headings but not to app headings, which may produce different orphan behaviour at 390/430px.
6. **Android font scaling:** Native `sp` units respond to system font size, while web `px`/`rem` may or may not follow WebView text autosizing. The app may present two different accessibility behaviours.
7. **Dialog title prominence:** A 14px uppercase dialog title may be visually too quiet relative to overlay content; needs screenshot review.
8. **Monospace mismatch:** Time wheels and OCR transcripts may render different glyph widths across Windows and Android because the mono family is platform-selected.

---

## 9. Responsive and Android-specific findings

### Breakpoints

- Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px.
- Custom media: `max-width: 420px`, `max-width: 480px`, `max-width: 639px`, `max-width: 767px`, `min-width: 768px`.
- Typography changes at 640px: masthead 1.3→1.6rem, archive card title 1.05→1.2rem or 1.55→1.85rem, document title 14→16px, capture back link 13→14px.
- Typography changes at 768px: landing hero/auth/document clamps switch to desktop values.
- **No typography change between 360, 390, and 430px.** All three targets use the same base sizes and the same 9px micro-labels. The 430px target only benefits from more width, not a different scale.

### Required viewport matrix

| Viewport | Source-level status | Visual status |
| --- | --- | --- |
| 360×800 | Covered by base/mobile rules | Not inspected |
| 390×844 | Covered by base/mobile rules | Not inspected |
| 430×932 | Covered by base/mobile rules | Not inspected |
| 1280×800 | Desktop clamps and `sm`/`md`/`lg` rules apply | Not inspected |
| 1440×900 | Desktop clamps and `sm`/`md`/`lg` rules apply | Not inspected |

### Android

- The Capacitor shell is a bare WebView (`activity_main.xml`); web typography applies there.
- The native alarm activity is the only native text UI and uses system faces, synthetic bold/italic, and `sp` sizes.
- No Android font resources are bundled in `res/font`; only the web font files exist under `assets/public/fonts`.
- `MainActivity.java` adjusts WebView insets but does not alter text scaling or typography.
- Whether Android WebView applies text autosizing or honours user font scale for the web UI is unverified.

---

## 10. Duplicate, conflicting, and unused definitions

| Item | Location | Issue |
| --- | --- | --- |
| `--text-xs` | `token.css:125` vs Tailwind theme | Value redefined; paired line-height not redefined |
| `--leading-tight` | `token.css:133` vs Tailwind theme | Declared twice; final runtime is 1.15 |
| `--font-display`, `--font-body` | `token.css:47-49,87-88` | Duplicated in `@theme` and `:root` |
| `.text-display` vs `.vault-display` | `global.css:408-416,439-447` | Identical roles; neither is used |
| `.vault-body` | `global.css:459-464` | Defined, never used |
| `.vault-label` | `global.css:467-473` | Defined, never used |
| `.vault-heading` vs `.vault-section-title` | `global.css:450-456,531-539` | Two heading roles at the same level |
| `.vault-meta` vs `.text-micro` vs `.folio` vs `.vault-section-folio` | `global.css:419-432,475-483,523-529` | Four overlapping eyebrow roles |
| `font-mono` | 6 component files | Used without a family definition |
| `font-sans` | `CaptureFab.tsx:688,992` | Assumed to mean Inter, actually system UI |
| `.frame-statement` | `landing/accession.css:260-286`; `accession/document.css:90-130,176-191` | Split across two stylesheets with overlapping selectors |
| `.accession-shell`, `.accession-folio` | `landing/accession.css`; `accession/document.css` | Defined in both files; landing file imported after document file |
| `--text-heading` | `token.css:130` | Defined, never referenced |
| `--text-display` | `token.css:131` | Only used by unused classes |
| Comment filenames | `global.css:38,339` | Comments refer to `tokens.css`; actual file is `token.css` |

---

## 11. Proposed semantic typography architecture

This is a proposed direction only; no final sizes, names, or values are approved or implemented.

### Families

- `--font-serif` — Instrument Serif; editorial display and pull statements only.
- `--font-display` — Space Grotesk; structural headings and labels.
- `--font-body` — Inter; all reading text and controls.
- `--font-mono` — one explicitly chosen mono family; data, time, OCR transcript, hex values.
- Remove or remap `font-sans`; never use it as an accidental alias.
- Android: bundle the same families in `res/font` (or use downloadable fonts) and use real weights instead of synthetic bold.

### Semantic roles

| Role | Intent | Current equivalents to replace |
| --- | --- | --- |
| `type-display-xl` | Marketing hero | landing `.accession-hero h1` |
| `type-display-lg` | Auth/document hero | auth/document `h1`, `.frame-statement h2` |
| `type-title-page` | App masthead / page title | `ArchiveIdentity` h1 |
| `type-title-section` | Section heading | `.vault-section-title` |
| `type-title-group` | Nested group heading | favourite group H3s, search group H3s |
| `type-title-card` | Card/item title | `ArchiveObject`, `NoteCard`, `DocumentCard`, `RemindersPanel` |
| `type-eyebrow` | Small uppercase label | `.vault-meta`, `.text-micro`, `.folio`, `.vault-section-folio` |
| `type-body-lg` | Long-form reading | landing deck, note body |
| `type-body` | Default paragraph | inherited body |
| `type-body-sm` | Secondary copy | 14px helper text |
| `type-label` | Form/control label | `.vault-label` and utility stacks |
| `type-action` | Button label | `.vault-action` |
| `type-meta` | Muted metadata | `.vault-meta` |
| `type-data` | Time, counts, hex, OCR | `font-mono` usages |

### Rules

1. One heading family per level; do not mix serif and uppercase grotesk at the same semantic level.
2. Heading levels must be monotonically non-increasing in visual size from `h1` to `h4`.
3. Role classes own family, size, weight, line-height, tracking, and case; component code should not re-specify them with utility stacks.
4. Publish a single tracking scale (for example tight/normal/wide/widest) and map every uppercase role to one step.
5. Publish a weight scale (400/500/600) and eliminate 700 from structural labels unless the family genuinely provides it and the hierarchy requires it.
6. Define paired line-heights for every size token; never redefine a size without its line-height.
7. Set a legibility floor for meaningful labels (at least 11–12px; 16px for inputs) and reserve 9–10px for non-essential ornament only.
8. Keep user-generated content in its original case unless a design decision explicitly opts into uppercase transformation.
9. Use fluid `clamp()` only for display sizes; use fixed, tokenized sizes for app UI.
10. Make Android native surfaces consume the same role names and families, using `sp` and real font weights.

---

## 12. Prioritized remediation backlog

### P0 — Correctness and cascade

1. Fix the `.vault-meta` / `.vault-action` / `.vault-heading` / `.folio` utility-order conflicts so component modifiers work as written.
2. Re-pair `--text-xs` with a line-height that matches 13px.
3. Choose one heading system for `h2` and align dialog and section headings to it.
4. Restore `VaultButton` size differentiation (or intentionally collapse the size API and document it).

### P1 — Token and family cleanup

5. Declare `--font-mono`; remove or remap `font-sans`.
6. Remove unused `.text-display`, `.vault-display`, `.vault-body`, `.vault-label`, `--text-heading`.
7. Merge the four eyebrow roles into one token family plus documented variants.
8. Define a single weight and tracking scale.

### P2 — Scale consolidation

9. Collapse micro-label sizes to a defined set (for example meta, label, action).
10. Standardize input text size across `VaultInput`, auth, landing, and capture.
11. Standardize page-title weight and size across masthead, shared view, account, and error states.
12. Normalize tabular numerals for all time/count/data surfaces.

### P3 — Platform and verification

13. Bring Android native alarm typography onto the same family/role system.
14. Preload the body and display faces, or document the intended FOUT behaviour.
15. Run visual checks at 360×800, 390×844, 430×932, 1280×800, and 1440×900.
16. Run an Android device/emulator pass for text scaling, clipping, and monospace width.

---

## 13. Verification gaps and limitations

- **No visual verification:** All findings are source/CSS inspections. No browser, screenshot, or device rendering was performed in this audit.
- **Built-CSS staleness:** Cascade-order findings use the existing `dist` bundle (`index-g9iWv6JL.css`, mirrored in the Android assets). The working tree contains uncommitted changes, so the bundle may not exactly match current source. Running a build would have modified the workspace and was intentionally avoided.
- **Responsive behaviour:** Viewport conclusions are inferred from media queries and `clamp()` expressions, not measured.
- **Android runtime:** No emulator or device was used. Native alarm typography is source-confirmed but not visually confirmed.
- **Contrast and legibility:** No contrast ratios or font metrics were measured; low-opacity/9px observations are potential risks, not proven failures.
- **Dynamic content:** Long titles, non-Latin text, emoji, and user-entered casing were not rendered, so overflow/clipping behaviour is unverified.
- **Test coverage:** Existing Playwright visual snapshots were not regenerated. No unit or E2E test asserts typography tokens or role usage.
- **Font licensing and hosting:** Font files exist locally and are self-hosted; licensing was not reviewed.

---

## 14. Read-only audit confirmation

This audit did not modify any application source, stylesheet, configuration, test, asset, dependency, database, deployment, or Git state. No build, lint, test, install, sync, commit, or branch operation was performed. The only file created is this report at `docs/audits/typography-audit.md`.
