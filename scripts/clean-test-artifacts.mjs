// Removes Playwright output dirs (test-results, playwright-report) before a run.
// On Windows, leftover `.playwright-artifacts-*`/trace files from a prior or
// interleaved run make workers collide on worker-indexed directories, surfacing
// as `ENOENT: no such file or directory ...traces\*.trace` during teardown.
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
for (const dir of ['test-results', 'playwright-report']) {
  const target = resolve(root, dir)
  rmSync(target, { recursive: true, force: true })
  console.log(`cleaned ${dir}/`)
}