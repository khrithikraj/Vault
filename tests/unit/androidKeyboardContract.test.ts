import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Source-contract guard for the soft-keyboard fix.
 *
 * The bug is invisible to the browser test suite: on Android 15+ (target SDK
 * 35) the platform enforces edge-to-edge, so `adjustResize` no longer resizes
 * the window for the keyboard and Capacitor never applies the IME inset. The
 * fix therefore lives in the native layer (MainActivity) plus the shared
 * dialog layout contract, and both are guarded here as source contracts.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

function collectTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectTsxFiles(full))
    } else if (entry.endsWith('.tsx')) {
      files.push(full)
    }
  }
  return files
}

describe('android keyboard/IME inset contract', () => {
  const mainActivity = read('android/app/src/main/java/com/khrithikraj/vault/MainActivity.java')
  const manifest = read('android/app/src/main/AndroidManifest.xml')
  const appGradle = read('android/app/build.gradle')

  it('keeps adjustResize so the window still reacts to the soft keyboard', () => {
    expect(manifest).toContain('android:windowSoftInputMode="adjustResize"')
  })

  it('applies the IME inset to the WebView on API 35 and above', () => {
    expect(mainActivity).toContain('ViewCompat.setOnApplyWindowInsetsListener')
    expect(mainActivity).toContain('WindowInsetsCompat.Type.ime()')
    // Below API 35 the framework still pads the root views, so the IME inset
    // must only be applied from API 35 (VANILLA_ICE_CREAM) upwards.
    expect(mainActivity).toContain('VANILLA_ICE_CREAM')
    expect(mainActivity).toContain('Build.VERSION_CODES.VANILLA_ICE_CREAM')
  })

  it('keeps the system bar and cutout insets and consumes the result', () => {
    expect(mainActivity).toContain('WindowInsetsCompat.Type.systemBars()')
    expect(mainActivity).toContain('WindowInsetsCompat.Type.displayCutout()')
    expect(mainActivity).toContain('WindowInsetsCompat.CONSUMED')
  })

  it('declares the androidx core dependency used for the inset APIs', () => {
    expect(appGradle).toContain('androidx.core:core:')
  })
})

describe('shared dialog layout contract', () => {
  const vaultDialog = read('src/components/ui/VaultDialog.tsx')

  it('lets the panel shrink inside the overlay so it cannot run under the keyboard', () => {
    expect(vaultDialog).toContain('data-dialog-panel')
    expect(vaultDialog).toContain('data-dialog-body')
    // The overlay is the layout shell: a full-height flex column.
    expect(vaultDialog).toContain('flex h-full w-full flex-col')
    // The panel may shrink, and the body owns the scrolling.
    expect(vaultDialog).toMatch(/data-dialog-panel[\s\S]{0,400}?min-h-0 flex-col/)
    expect(vaultDialog).toMatch(/data-dialog-body[\s\S]{0,400}?flex-1/)
    expect(vaultDialog).toMatch(/data-dialog-body[\s\S]{0,400}?overflow-y-auto/)
  })

  it('does not let consumers re-declare viewport-relative heights', () => {
    const offenders: string[] = []
    for (const file of collectTsxFiles(join(repoRoot, 'src'))) {
      const source = readFileSync(file, 'utf8')
      const usages = source.match(/<VaultDialog[\s\S]*?>/g) ?? []
      for (const usage of usages) {
        const props = usage.match(/[a-zA-Z]*[cC]lassName="[^"]*"/g) ?? []
        for (const prop of props) {
          // `dvh` tracks the dynamic viewport, which is exactly what shrinks
          // when the keyboard opens - the shared dialog owns that sizing.
          if (prop.includes('dvh')) offenders.push(`${file}: ${prop}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
