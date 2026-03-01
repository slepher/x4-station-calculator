import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type CaseDef = {
  name: string
  file: string
  expectedPoints: Array<{ case: string; error_code: string }>
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'skill-scripts', 'validate_test_case_refs.py')
const dataDir = path.join(repoRoot, 'tests', 'skills', 'data', 'impls')

const cases: CaseDef[] = [
  { name: 'baseline-pass', file: 'test_tasks-01-case-mapping-baseline.md', expectedPoints: [{ case: '4.1.1', error_code: 'COMMENT_MISSING' }] },
  {
    name: 'missing-unit-case',
    file: 'test_tasks-02-missing-unit-case.md',
    expectedPoints: [
      { case: '1.1', error_code: 'CASE_MISSING' },
      { case: '1.2', error_code: 'EXTRA_CASE_UNMAPPED' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'missing-comment',
    file: 'test_tasks-03-missing-comment.md',
    expectedPoints: [
      { case: '1.1.2', error_code: 'COMMENT_MISSING' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'l2-content-missing',
    file: 'test_tasks-04-l2-content-missing.md',
    expectedPoints: [
      { case: '1.1.1', error_code: 'BLOCK_CONTENT_MISSING' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'l3-content-missing',
    file: 'test_tasks-05-l3-content-missing.md',
    expectedPoints: [
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'expect-assert-missing',
    file: 'test_tasks-06-expect-assert-missing.md',
    expectedPoints: [
      { case: '1.1.2', error_code: 'EXPECT_ASSERTION_MISSING' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'expect-value-mismatch',
    file: 'test_tasks-07-expect-value-mismatch.md',
    expectedPoints: [
      { case: '1.1.2', error_code: 'EXPECT_VALUE_MISMATCH' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'ch4-pre-wrong-route',
    file: 'test_tasks-08-ch4-pre-wrong-route.md',
    expectedPoints: [
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
      { case: '4.1.2', error_code: 'COMMENT_MISSING' },
      { case: '4.1.2', error_code: 'COMMENT_ORDER_INVALID' },
    ],
  },
  {
    name: 'ch4-post-wrong-route',
    file: 'test_tasks-09-ch4-post-wrong-route.md',
    expectedPoints: [
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
      { case: '4.1.2', error_code: 'CH4_ROUTE_CONFLICT' },
      { case: '4.1.2', error_code: 'COMMENT_ORDER_INVALID' },
      { case: '4.1.2', error_code: 'EXPECT_VALUE_MISMATCH' },
    ],
  },
  { name: 'ch4-post-checked-no-bug-case', file: 'test_tasks-10-ch4-post-checked-no-bug-case.md', expectedPoints: [{ case: '4.2', error_code: 'EXTRA_CASE_UNMAPPED' }] },
  {
    name: 'ch4-post-checked-no-bugfix',
    file: 'test_tasks-11-ch4-post-checked-no-bugfix.md',
    expectedPoints: [
      { case: '4.1', error_code: 'CASE_MISSING' },
      { case: '4.2', error_code: 'EXTRA_CASE_UNMAPPED' },
    ],
  },
  {
    name: 'missing-e2e-case',
    file: 'test_tasks-12-missing-e2e-case.md',
    expectedPoints: [
      { case: '2.1', error_code: 'CASE_MISSING' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
  {
    name: 'case-order-invalid',
    file: 'test_tasks-13-case-order-invalid.md',
    expectedPoints: [{ case: '2.1', error_code: 'CASE_ORDER_INVALID' }],
  },
  {
    name: 'comment-order-invalid',
    file: 'test_tasks-14-comment-order-invalid.md',
    expectedPoints: [{ case: '1.1.1', error_code: 'COMMENT_ORDER_INVALID' }],
  },
  {
    name: 'extra-comment-unmapped',
    file: 'test_tasks-15-extra-comment-unmapped.md',
    expectedPoints: [
      { case: '1.1.9', error_code: 'EXTRA_COMMENT_UNMAPPED' },
      { case: '4.1.1', error_code: 'COMMENT_MISSING' },
    ],
  },
]

describe('validate_test_case_refs impl verify rules', () => {
  it('has required script and impl data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> validates specific case+error_code points`, () => {
      const filePath = path.join(dataDir, c.file)
      expect(existsSync(filePath)).toBe(true)

      const res = spawnSync('python3', [scriptPath, '--mode=test', '--file', filePath, '--json'], {
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
