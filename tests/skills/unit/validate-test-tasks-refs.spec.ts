import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type Point = { case: string; error_code: string }
type CaseDef = {
  name: string
  file: string
  expectedPoints: Point[]
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'skill-scripts', 'validate_test_tasks_refs.py')
const dataDir = path.join(repoRoot, 'tests', 'skills', 'data', 'tasks')

const cases: CaseDef[] = [
  { name: 'valid-minimal', file: 'test_tasks-01-valid-minimal.md', expectedPoints: [] },
  {
    name: 'missing-chapter-3',
    file: 'test_tasks-02-missing-chapter-3.md',
    expectedPoints: [
      { case: 'global', error_code: 'CHAPTER_ORDER_INVALID' },
      { case: '2.1', error_code: 'CHAPTER2_STATE_ISOLATED' },
    ],
  },
  {
    name: 'invalid-top-level-numbering',
    file: 'test_tasks-03-invalid-top-level-numbering.md',
    expectedPoints: [
      { case: '1', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '1.1.1', error_code: 'SUBTASK_WITHOUT_PARENT' },
      { case: '1.1.2', error_code: 'SUBTASK_WITHOUT_PARENT' },
    ],
  },
  {
    name: 'invalid-subtask-numbering',
    file: 'test_tasks-04-invalid-subtask-numbering.md',
    expectedPoints: [
      { case: '1.1', error_code: 'TOP_LEVEL_INDENT_INVALID' },
      { case: '1.1', error_code: 'TOP_LEVEL_SUBTASK_MISSING' },
      { case: '1.1', error_code: 'TOP_LEVEL_NUMBER_NOT_CONTIGUOUS' },
      { case: '1.1', error_code: 'TOP_LEVEL_SUBTASK_MISSING' },
    ],
  },
  {
    name: 'non-contiguous-subtask',
    file: 'test_tasks-05-non-contiguous-subtask.md',
    expectedPoints: [{ case: '1.1.3', error_code: 'SUBTASK_NUMBER_NOT_CONTIGUOUS' }],
  },
  {
    name: 'invalid-indent',
    file: 'test_tasks-06-invalid-indent.md',
    expectedPoints: [
      { case: '1', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '1.1', error_code: 'TOP_LEVEL_SUBTASK_MISSING' },
    ],
  },
  {
    name: 'deprecated-step-keyword',
    file: 'test_tasks-07-deprecated-step-keyword.md',
    expectedPoints: [
      { case: '1', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '1.1', error_code: 'TOP_LEVEL_SUBTASK_MISSING' },
    ],
  },
  {
    name: 'bug-header-style',
    file: 'test_tasks-08-bug-header-style.md',
    expectedPoints: [
      { case: '4', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '4.1', error_code: 'CHAPTER4_TOP_TYPE_INVALID' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_REPRO_STEP_MISSING' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_BEFORE_ASSERT_MISSING' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_AFTER_ASSERT_MISSING' },
    ],
  },
  {
    name: 'plain-text-in-chapter',
    file: 'test_tasks-09-plain-text-in-chapter.md',
    expectedPoints: [{ case: '1', error_code: 'CHAPTER_CONTENT_INVALID' }],
  },
  { name: 'mixed-checkbox-states', file: 'test_tasks-10-mixed-checkbox-states.md', expectedPoints: [] },
  {
    name: 'empty-file',
    file: 'test_tasks-11-empty-file.md',
    expectedPoints: [{ case: 'global', error_code: 'CHAPTER_ORDER_INVALID' }],
  },
  {
    name: 'multi-errors',
    file: 'test_tasks-12-multi-errors.md',
    expectedPoints: [
      { case: '1', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '1', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '4', error_code: 'CHAPTER_CONTENT_INVALID' },
      { case: '2.1', error_code: 'CHAPTER2_TOP_TYPE_INVALID' },
      { case: '2.1', error_code: 'TOP_LEVEL_SUBTASK_MISSING' },
      { case: '3.1', error_code: 'CHAPTER3_TOP_TYPE_INVALID' },
      { case: '3.1', error_code: 'TOP_LEVEL_SUBTASK_MISSING' },
    ],
  },
  { name: 'regression-stable', file: 'test_tasks-13-regression-stable.md', expectedPoints: [] },
  { name: 'top-level-last-expect-direct', file: 'test_tasks-14-top-level-last-expect-direct.md', expectedPoints: [] },
  { name: 'top-level-last-expect-children-all', file: 'test_tasks-15-top-level-last-expect-children-all.md', expectedPoints: [] },
  {
    name: 'top-level-last-expect-children-mixed',
    file: 'test_tasks-16-top-level-last-expect-children-mixed.md',
    expectedPoints: [{ case: '1.1.3.2', error_code: 'LAST_SUBTASK_CHILD_EXPECTATION_MISSING' }],
  },
  { name: 'expectation-marker-concrete', file: 'test_tasks-17-expectation-marker-concrete.md', expectedPoints: [] },
  { name: 'expectation-marker-ui-unified', file: 'test_tasks-18-expectation-marker-ui-unified.md', expectedPoints: [] },
  {
    name: 'bug-missing-colon',
    file: 'test_tasks-19-bug-missing-colon.md',
    expectedPoints: [
      { case: '4.1', error_code: 'CHAPTER4_TOP_TYPE_INVALID' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_BEFORE_ASSERT_MISSING' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_AFTER_ASSERT_MISSING' },
    ],
  },
  {
    name: 'case-name-duplicated',
    file: 'test_tasks-20-case-name-duplicated.md',
    expectedPoints: [{ case: '3.2', error_code: 'CHAPTER3_CASE_NAME_DUPLICATED' }],
  },
  {
    name: 'case-ref-missing',
    file: 'test_tasks-21-case-ref-missing.md',
    expectedPoints: [{ case: '2.1', error_code: 'CHAPTER2_STATE_ISOLATED' }],
  },
  {
    name: 'bug-root-cause-desc',
    file: 'test_tasks-22-bug-root-cause-desc.md',
    expectedPoints: [
      { case: '4.1', error_code: 'CHAPTER4_BUG_DESC_SHOULD_BE_OBSERVABLE' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_BEFORE_ASSERT_MISSING' },
      { case: '4.1', error_code: 'CHAPTER4_BUG_AFTER_ASSERT_MISSING' },
    ],
  },
  { name: 'bug-before-after-same-number', file: 'test_tasks-23-bug-before-after-same-number.md', expectedPoints: [] },
  {
    name: 'bug-before-after-number-mismatch',
    file: 'test_tasks-24-bug-before-after-number-mismatch.md',
    expectedPoints: [{ case: '4.1', error_code: 'CHAPTER4_BUG_BEFORE_AFTER_NUMBER_MISMATCH' }],
  },
]

const sortPoints = (arr: Point[]) =>
  [...arr].sort((a, b) => `${a.case}#${a.error_code}`.localeCompare(`${b.case}#${b.error_code}`))

describe('validate_test_tasks_refs robustness cases', () => {
  it('has required script and data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> validates exact case+error_code points`, () => {
      const filePath = path.join(dataDir, c.file)
      expect(existsSync(filePath)).toBe(true)

      const res = spawnSync('python3', [scriptPath, '--file', filePath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf-8',
      })

      let payload: Array<{ case: string; error_code: string }> = []
      try {
        payload = JSON.parse((res.stdout || '[]').trim() || '[]')
      } catch {
        throw new Error(`invalid json output: ${res.stdout}`)
      }

      const actualPoints: Point[] = payload.map((x) => ({ case: x.case, error_code: x.error_code }))
      expect(sortPoints(actualPoints)).toEqual(sortPoints(c.expectedPoints))
      expect(res.status).toBe(c.expectedPoints.length === 0 ? 0 : 1)
    })
  }
})
