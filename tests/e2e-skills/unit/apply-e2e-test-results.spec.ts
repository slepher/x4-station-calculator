import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type RunCase = {
  name: string
  suffix: string
  successes?: string
  failures?: string
  failSteps?: string
  expectedPoints: Array<{ case: string; error_code: string }>
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, '.trae', 'skills', 'x4-e2e-test-run', 'scripts', 'apply_e2e_test_results.py')
const dataDir = path.join(repoRoot, 'tests', 'e2e-skills', 'data', 'runs')

const cases: RunCase[] = [
  {
    name: 'pass-and-fail',
    suffix: '01-pass-and-fail',
    successes: '1.1',
    failures: '1.2',
    failSteps: '1.2.2',
    expectedPoints: [],
  },
  {
    name: 'unmentioned-unchanged',
    suffix: '02-unmentioned-unchanged',
    successes: '1.1',
    expectedPoints: [],
  },
  {
    name: 'input-mismatch',
    suffix: '01-pass-and-fail',
    failures: '1.1',
    expectedPoints: [{ case: 'global', error_code: 'INPUT_MISMATCH' }],
  },
]

const sortPoints = (arr: Array<{ case: string; error_code: string }>) =>
  [...arr].sort((a, b) => `${a.case}#${a.error_code}`.localeCompare(`${b.case}#${b.error_code}`))

describe('apply_e2e_test_results', () => {
  it('has required script and data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> applies or reports expected errors`, () => {
      const sourcePath = path.join(dataDir, `e2e_test_tasks-${c.suffix}.md`)
      expect(existsSync(sourcePath)).toBe(true)

      const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'x4-e2e-skills-'))
      const workPath = path.join(tmpDir, 'e2e_test_tasks.md')
      copyFileSync(sourcePath, workPath)

      const args = [scriptPath, '--file', workPath, '--json']
      if (c.successes) args.push('--successes', c.successes)
      if (c.failures) args.push('--failures', c.failures)
      if (c.failSteps) args.push('--fail-steps', c.failSteps)

      const res = spawnSync('python3', args, {
        cwd: repoRoot,
        encoding: 'utf-8',
      })

      const payload: Array<{ case: string; error_code: string }> = JSON.parse((res.stdout || '[]').trim() || '[]')
      const actualPoints = payload.map((x) => ({ case: x.case, error_code: x.error_code }))
      expect(sortPoints(actualPoints)).toEqual(sortPoints(c.expectedPoints))
      expect(res.status).toBe(c.expectedPoints.length === 0 ? 0 : 1)

      if (c.expectedPoints.length === 0) {
        const expectedPath = path.join(dataDir, `e2e_test_tasks_run-${c.suffix}.md`)
        expect(readFileSync(workPath, 'utf-8')).toBe(readFileSync(expectedPath, 'utf-8'))
      }
    })
  }
})
