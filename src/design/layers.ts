/**
 * RAJ'S VAULT — LAYER / Z-INDEX SYSTEM
 * ----------------------------------------------------------------------
 * Single vocabulary for stacking contexts. These map onto the --z-*
 * tokens in styles/tokens.css. Use these values instead of raw `z-10`,
 * `z-50` etc. so future collisions are avoided.
 *
 * Conceptual ladder (low → high):
 *   base → content → floating → navigation → progress → dropdown → tour
 *   → overlay → modal → popover → toast
 * ======================================================================
 */
export const layers = {
  base: 0,
  content: 10,
  floating: 20,
  navigation: 30,
  progress: 35,
  dropdown: 40,
  tour: 45,
  tourTooltip: 46,
  overlay: 50,
  modal: 60,
  popover: 70,
  toast: 80,
} as const
 
export type Layer = keyof typeof layers

export const z = (layer: Layer): number => layers[layer]

/**
 * Marks a portaled surface that logically belongs to an open dialog/popover but
 * has to render as a sibling of it on <body> — otherwise a transformed ancestor
 * (e.g. the centred popover's `translate`) would become its containing block and
 * clip it. Because the two are DOM siblings rather than parent/child, a
 * dismissal handler that only checks `ref.contains(event.target)` reads a click
 * inside the child as "outside" and closes the very dialog it belongs to. Any
 * surface carrying this attribute is treated as part of its opener.
 */
export const NESTED_LAYER_ATTR = 'data-vault-nested-layer'

export const nestedLayerSelector = `[${NESTED_LAYER_ATTR}]`