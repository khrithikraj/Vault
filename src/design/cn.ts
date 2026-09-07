/**
 * RAJ'S VAULT — CLASSNAME UTILITY
 * Minimal dependency-free merge of conditional Tailwind classes.
 * Falsy values are dropped; the rest are joined.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
