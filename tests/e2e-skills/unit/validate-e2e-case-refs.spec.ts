import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type Point = { error_code: string }
type CaseDef = {
  name: string
  dir: string
  expectedPoints: Point[]
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, '.trae', 'skills', 'x4-e2e-test-impl', 'scripts', 'validate_e2e_case_refs.py')
const dataDir = path.join(repoRoot, 'tests', 'e2e-skills', 'data', 'impls')

const cases: CaseDef[] = [
  { name: 'valid', dir: '01-valid', expectedPoints: [] },
  { name: 'missing-comment', dir: '02-missing-comment', expectedPoints: [{ error_code: 'SUBTASK_COMMENT_MISSING' }] },
  { name: 'extra-case', dir: '03-extra-case', expectedPoints: [{ error_code: 'TEST_CASE_EXTRA' }] },
  { name: 'comment-without-code', dir: '04-comment-without-code', expectedPoints: [{ error_code: 'SUBTASK_COMMENT_WITHOUT_CODE' }] },
]

const sortPoints = (arr: Point[]) =>
  [...arr].sort((a, b) => a.error_code.localeCompare(b.error_code))

describe('validate_e2e_case_refs', () => {
  it('has required script and data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> validates expected error codes`, () => {
      const caseDir = path.join(dataDir, c.dir)
      const tasksPath = path.join(caseDir, 'e2e_test_tasks.md')
      expect(existsSync(caseDir)).toBe(true)
      expect(existsSync(tasksPath)).toBe(true)

      const res = spawnSync('python3', [scriptPath, '--tasks', tasksPath, '--tests-dir', caseDir, '--json'], {
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
