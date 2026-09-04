import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const implDataDir = path.join(repoRoot, 'tests', 'skills', 'data', 'impls')

describe('test-impl data asset conventions', () => {
  it('has impl data directory', () => {
    expect(existsSync(implDataDir)).toBe(true)
  })

  it('uses required naming conventions in tests/skills/data/impls', () => {
    const files = readdirSync(implDataDir)
    const taskFiles = files.filter((f) => f.endsWith('.md'))
    const implSpecFiles = files.filter((f) => f.endsWith('.spec.ts'))

    for (const f of taskFiles) {
      expect(f).toMatch(/^test_tasks-\d{2}-[a-z0-9-]+\.md$/)
    }

    for (const f of implSpecFiles) {
      expect(f).toMatch(
        /^test-(unit|e2e|bug|bug-fix)-\d{2}-[a-z0-9-]+\.spec\.ts$/,
      )
    }
  })

  it('keeps paired task/four-spec assets by the same N and case-name', () => {
    const files = readdirSync(implDataDir)
    const taskFiles = files.filter((f) => f.endsWith('.md'))

    for (const taskFile of taskFiles) {
      const m = taskFile.match(/^test_tasks-(\d{2}-[a-z0-9-]+)\.md$/)
      expect(m).not.toBeNull()
      const suffix = m![1]
      const unitSpec = path.join(implDataDir, `test-unit-${suffix}.spec.ts`)
      const e2eSpec = path.join(implDataDir, `test-e2e-${suffix}.spec.ts`)
      const bugSpec = path.join(implDataDir, `test-bug-${suffix}.spec.ts`)
      const bugFixSpec = path.join(implDataDir, `test-bug-fix-${suffix}.spec.ts`)
      expect(existsSync(unitSpec)).toBe(true)
      expect(existsSync(e2eSpec)).toBe(true)
      expect(existsSync(bugSpec)).toBe(true)
      expect(existsSync(bugFixSpec)).toBe(true)
    }
  })
})
