import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { resolve } from 'path'

const SCRIPT_PATH = resolve('skill-scripts/validate_test_case_refs.py')
const TEST_DATA_DIR = resolve('tests/legacy/skills/x4-test/data/impls')

function runValidation(args: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`python3 ${SCRIPT_PATH} ${args}`, {
      encoding: 'utf-8',
      cwd: resolve('.'),
    })
    return { stdout, stderr: '', code: 0 }
  } catch (err: any) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status || 1 }
  }
}

describe('1.31 validate --cases 参数过滤校验', () => {
  it('1.31.1 单个 case 过滤验证', () => {
    const result = runValidation(
      `--mode=test --file ${TEST_DATA_DIR}/test_tasks-01-case-mapping-baseline.md --cases 1.1`
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('PASS')
    expect(result.stdout).not.toContain('EXTRA_CASE_UNMAPPED')
  })

  it('1.31.2 多个 case 过滤验证', () => {
    const result = runValidation(
      `--mode=test --file ${TEST_DATA_DIR}/test_tasks-01-case-mapping-baseline.md --cases 1.1,2.1`
    )
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('PASS')
    expect(result.stdout).not.toContain('EXTRA_CASE_UNMAPPED')
  })

  it('1.31.3 不指定 --cases 时应检查 EXTRA_CASE_UNMAPPED', () => {
    const result = runValidation(
      `--mode=test --file ${TEST_DATA_DIR}/test_tasks-01-case-mapping-baseline.md`
    )
    expect(result.stdout).toContain('FAIL')
  })
})
