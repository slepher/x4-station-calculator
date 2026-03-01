import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type RunCase = {
  name: string
  file: string
  successes?: string
  failures?: string
  failSteps?: string
  expectedPoints: Array<{ case: string; error_code: string }>
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'skill-scripts', 'validate_test_results.py')
const dataDir = path.join(repoRoot, 'tests', 'skills', 'data', 'runs')

const cases: RunCase[] = [
  {
    name: 'pass-basic',
    file: 'test_tasks-01-pass-basic.md',
    successes: '1.1',
    expectedPoints: [],
  },
  {
    name: 'fail-l2',
    file: 'test_tasks-02-fail-l2.md',
    failures: '1.1',
    failSteps: '1.1.2',
    expectedPoints: [],
  },
  {
    name: 'fail-l3',
    file: 'test_tasks-03-fail-l3.md',
    failures: '1.1',
    failSteps: '1.1.2.2',
    expectedPoints: [],
  },
  {
    name: 'unmentioned-unchanged',
    file: 'test_tasks-04-unmentioned-unchanged.md',
    successes: '1.2',
    expectedPoints: [],
  },
  {
    name: 'input-mismatch',
    file: 'test_tasks-05-input-mismatch.md',
    failures: '1.1',
    expectedPoints: [
      { case: 'global', error_code: 'INPUT_MISMATCH' },
      { case: '1.1', error_code: 'FAIL_STEP_MISSING' },
    ],
  },
]

describe('validate_test_results run apply mode=test', () => {
  it('has required script and runs data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> validates expected case+error_code points`, () => {
      const filePath = path.join(dataDir, c.file)
      expect(existsSync(filePath)).toBe(true)

      const args = [scriptPath, '--mode=test', '--file', filePath, '--json']
      if (c.successes) args.push('--successes', c.successes)
      if (c.failures) args.push('--failures', c.failures)
      if (c.failSteps) args.push('--fail-steps', c.failSteps)

      const res = spawnSync('python3', args, {
        cwd: repoRoot,
        encoding: 'utf-8',
      })

      let payload: Array<{ case: string; desc: string; error_code: string; error_msg: string }> = []
      try {
        payload = JSON.parse((res.stdout || '[]').trim() || '[]')
      } catch {
        throw new Error(`invalid json output: ${res.stdout}`)
      }

      const actualPoints = payload.map((x) => ({ case: x.case, error_code: x.error_code }))
      const sortPoints = (arr: Array<{ case: string; error_code: string }>) =>
        [...arr].sort((a, b) => `${a.case}#${a.error_code}`.localeCompare(`${b.case}#${b.error_code}`))

      if (c.expectedPoints.length === 0) {
        expect(actualPoints).toEqual([])
        expect(res.status).toBe(0)
      } else {
        expect(sortPoints(actualPoints)).toEqual(sortPoints(c.expectedPoints))
        expect(res.status).toBe(1)
      }
    })
  }
})
