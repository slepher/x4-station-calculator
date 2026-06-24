import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type Point = { error_code: string }
type CaseDef = {
  name: string
  suffix: string
  expectedPoints: Point[]
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, '.trae', 'skills', 'x4-e2e-test-doc-details', 'scripts', 'validate_e2e_test_docs.py')
const dataDir = path.join(repoRoot, 'tests', 'e2e-skills', 'data', 'docs')

const cases: CaseDef[] = [
  { name: 'valid', suffix: '01-valid', expectedPoints: [] },
  { name: 'subtask-forbidden', suffix: '02-subtask-forbidden', expectedPoints: [{ error_code: 'SUBTASK_FORBIDDEN' }] },
  { name: 'description-mismatch', suffix: '03-description-mismatch', expectedPoints: [{ error_code: 'TASK_DESCRIPTION_MISMATCH' }] },
  { name: 'extra-task', suffix: '04-extra-task', expectedPoints: [{ error_code: 'TASK_MAPPING_EXTRA' }] },
]

const sortPoints = (arr: Point[]) =>
  [...arr].sort((a, b) => a.error_code.localeCompare(b.error_code))

describe('validate_e2e_test_docs', () => {
  it('has required script and data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> validates expected error codes`, () => {
      const testsPath = path.join(dataDir, `e2e_tests-${c.suffix}.md`)
      const tasksPath = path.join(dataDir, `e2e_test_tasks-${c.suffix}.md`)
      expect(existsSync(testsPath)).toBe(true)
      expect(existsSync(tasksPath)).toBe(true)

      const res = spawnSync('python3', [scriptPath, '--tests', testsPath, '--tasks', tasksPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf-8',
      })

      const payload = JSON.parse((res.stdout || '{"errors":[]}').trim() || '{"errors":[]}')
      const actualPoints: Point[] = payload.errors.map((x: { error_code: string }) => ({ error_code: x.error_code }))
      expect(sortPoints(actualPoints)).toEqual(sortPoints(c.expectedPoints))
      expect(res.status).toBe(c.expectedPoints.length === 0 ? 0 : 1)
    })
  }
})
