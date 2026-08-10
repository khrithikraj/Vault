# Raj's Vault — Design System (Redesign)

Direction (locked with the user): **push the existing Oryzo darkroom-editorial system to the extreme** — CSS 3D + motion only, whole app.

Source references:
- refero.design style "Oryzo" (darkroom editorial): warm-dark canvas `#100904`, bark `#382416`, cork border `#40372e`, driftwood `#6c5f51`, cream ink `#ffedd7`, ember accent `#dc5000` (editorial-only, never the sole CTA fill pattern), radius vocabulary 12px / 22.5px / full pill, depth from the surface stack (no shadows), 1px dashed dividers, uppercase weight-500 display at line-height 0.9.
- ui-ux-pro-max skill: generator recommended "Vibrant & block-based / Caveat+Quicksand" — **rejected** as it clashes with the locked editorial direction. Adopted instead its editorial-aware data + checklist (cursor-pointer, 150-300ms hovers, focus states, prefers-reduced-motion, no emoji-as-icon where feasible).

## Locked decisions

- **Typography:** Display = **Space Grotesk** (grotesque family, closest Google-font analogue to Halyard Display; weights 400–700). Body/UI = **Inter** (unchanged). Display headings: uppercase, weight 500, line-height 0.9, `clamp(2.5rem, 7vw, 5rem)` (`.text-display`). Micro labels: uppercase, wide tracking (`.text-micro`).
- **3D:** CSS 3D + motion only. No three.js / @react-three/fiber. Transform/opacity-only animations, `will-change` sparingly.
- **Effects layer:** film grain, dust motes, rim light + light leak, reflections, ember glow, folio/serial labels, scroll progress hairline, magnetic CTAs, deeper tilt.
- **Rules kept:** one filled CTA per section; ember stays an accent; radius vocabulary; hairline dashed dividers; reduced-motion fallbacks everywhere.

## Token additions (Phase 1)

See `tokens.css` / `global.css`. New: `--font-display` (Space Grotesk), `--font-body` (Inter), Minor-Third type scale, `.text-display`, `.text-micro`, `.folio`, `.focus-ring`, `.film-grain`, `.rim-light`, `.glow-ember`, reflection utility.

## Delivery log (Phases 2–5) — 2026-08-11

All five phases landed; `tsc`, `vite build`, and `eslint` all pass. Every screen was escalated within the locked Oryzo direction, CSS 3D + motion only.

- **Foundation primitives:** `Atmosphere` (supersedes `AmbientBackground` — category-aware void glow + film grain + dust, reduced-motion safe), `FilmGrain`, `DustMotes`, `DisplayHeading`, `VerticalSerial` ("RAJ'S — VAULT 01"), `ScrollProgress` (ember hairline), `Magnetic`, `TiltCard` (deeper tilt + hover lift + grounding shadow + optional `trailColor`).
- **Landing:** intro/closing → `.text-display` with per-usage `--text-display` clamp overrides; chapter folio tracked live off the camera progress; particle field denser with occasional ember motes; journal cover/content pages set in the display face with folio page numbers; fallback keeps the same type system.
- **Auth:** lock → `VaultArtifact` (a tumbling, rim-lit 3D vault-door cube with floor glow); giant `.text-display` shimmer heading; the form is a floating slab — rotateX-from-floor spring entrance, ember `BorderTrail`, `rim-light`, pill tab with sliding `layoutId` marker; `UpdatePasswordScreen` matches. Both fully reduced-motion gated.
- **Vault shell:** display heading + folio `Vol. I — RAJ'S` in the header; folio-numbered section dividers (`01` Categories / `02` Everything); category cards are 3D staggered slabs (idle float/rotateY/z per index, ember active trail, big folio counts); item cards get the polaroid-deck hover (3D lift + reflection + fan) and an ember "DONE" stamp; dock active pill glows ember; capture wizard enters as a 3D slab + the FAB breathes an ember halo (ghost-fly-to-dock kept); detail overlay opens in 3D with a rim-lit photo and folio metadata row; note cards tilt in 3D with a done-stamp.

**To eyeball it:** `npm run dev` → http://localhost:5173/ — walk landing → (sign-in) → "Dev only: preview without signing in" for the mock vault. Supabase is on placeholder env vars, so real auth needs real credentials in `.env.local`.

