import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type CaseDef = {
  name: string
  file: string
  expectedExitCode: 0 | 1
}

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'skill-scripts', 'validate_test_tasks_refs.py')
const dataDir = path.join(repoRoot, 'tests', 'skills', 'data', 'tasks')

const cases: CaseDef[] = [
  { name: 'valid-minimal', file: 'test_tasks-01-valid-minimal.md', expectedExitCode: 0 },
  { name: 'missing-chapter-3', file: 'test_tasks-02-missing-chapter-3.md', expectedExitCode: 1 },
  { name: 'invalid-top-level-numbering', file: 'test_tasks-03-invalid-top-level-numbering.md', expectedExitCode: 1 },
  { name: 'invalid-subtask-numbering', file: 'test_tasks-04-invalid-subtask-numbering.md', expectedExitCode: 1 },
  { name: 'non-contiguous-subtask', file: 'test_tasks-05-non-contiguous-subtask.md', expectedExitCode: 1 },
  { name: 'invalid-indent', file: 'test_tasks-06-invalid-indent.md', expectedExitCode: 1 },
  { name: 'deprecated-step-keyword', file: 'test_tasks-07-deprecated-step-keyword.md', expectedExitCode: 1 },
  { name: 'bug-header-style', file: 'test_tasks-08-bug-header-style.md', expectedExitCode: 1 },
  { name: 'plain-text-in-chapter', file: 'test_tasks-09-plain-text-in-chapter.md', expectedExitCode: 1 },
  { name: 'mixed-checkbox-states', file: 'test_tasks-10-mixed-checkbox-states.md', expectedExitCode: 0 },
  { name: 'empty-file', file: 'test_tasks-11-empty-file.md', expectedExitCode: 1 },
  { name: 'multi-errors', file: 'test_tasks-12-multi-errors.md', expectedExitCode: 1 },
  { name: 'regression-stable', file: 'test_tasks-13-regression-stable.md', expectedExitCode: 0 },
  { name: 'top-level-last-expect-direct', file: 'test_tasks-14-top-level-last-expect-direct.md', expectedExitCode: 0 },
  { name: 'top-level-last-expect-children-all', file: 'test_tasks-15-top-level-last-expect-children-all.md', expectedExitCode: 0 },
  { name: 'top-level-last-expect-children-mixed', file: 'test_tasks-16-top-level-last-expect-children-mixed.md', expectedExitCode: 1 },
  { name: 'expectation-marker-concrete', file: 'test_tasks-17-expectation-marker-concrete.md', expectedExitCode: 0 },
  { name: 'expectation-marker-ui-unified', file: 'test_tasks-18-expectation-marker-ui-unified.md', expectedExitCode: 0 },
  { name: 'bug-missing-colon', file: 'test_tasks-19-bug-missing-colon.md', expectedExitCode: 1 },
  { name: 'case-name-duplicated', file: 'test_tasks-20-case-name-duplicated.md', expectedExitCode: 1 },
  { name: 'case-ref-missing', file: 'test_tasks-21-case-ref-missing.md', expectedExitCode: 1 },
  { name: 'bug-root-cause-desc', file: 'test_tasks-22-bug-root-cause-desc.md', expectedExitCode: 1 },
]

describe('validate_test_tasks_refs robustness cases', () => {
  it('has required script and data directory', () => {
    expect(existsSync(scriptPath)).toBe(true)
    expect(existsSync(dataDir)).toBe(true)
  })

  for (const c of cases) {
    it(`${c.name} -> exit ${c.expectedExitCode}`, () => {
      const filePath = path.join(dataDir, c.file)
      expect(existsSync(filePath)).toBe(true)

      const res = spawnSync('python3', [scriptPath, '--file', filePath], {
        cwd: repoRoot,
        encoding: 'utf-8',
      })

      expect(res.status).toBe(c.expectedExitCode)
    })
  }
})
