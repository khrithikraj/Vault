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