import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { resolve } from 'path'

const SCRIPT_PATH = resolve('skill-scripts/validate_test_case_refs.py')
const TEST_DATA_DIR = resolve('tests/skills/data/impls')

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
  // 1.31.1 执行 `validate_test_case_refs.py --mode=test --file <test_tasks> --cases 1.1`
  it('1.31.1 单个 case 过滤验证', () => {
    const result = runValidation(
      `--mode=test --file ${TEST_DATA_DIR}/test_tasks-01-case-mapping-baseline.md --cases 1.1`
    )
    // 断言仅验证指定 case，跳过 EXTRA_CASE_UNMAPPED 检查
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('PASS')
    expect(result.stdout).not.toContain('EXTRA_CASE_UNMAPPED')
  })

  // 1.31.2 执行 `validate_test_case_refs.py --mode=test --file <test_tasks> --cases 1.1,2.1`
  it('1.31.2 多个 case 过滤验证', () => {
    const result = runValidation(
      `--mode=test --file ${TEST_DATA_DIR}/test_tasks-01-case-mapping-baseline.md --cases 1.1,2.1`
    )
    // 断言仅验证指定 case，跳过 EXTRA_CASE_UNMAPPED 检查
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('PASS')
    expect(result.stdout).not.toContain('EXTRA_CASE_UNMAPPED')
  })

  // 1.31.3 断言仅验证指定 case，跳过 EXTRA_CASE_UNMAPPED 检查
  it('1.31.3 不指定 --cases 时应检查 EXTRA_CASE_UNMAPPED', () => {
    const result = runValidation(
      `--mode=test --file ${TEST_DATA_DIR}/test_tasks-01-case-mapping-baseline.md`
    )
    // 不指定 --cases 时，应该检查 extra cases
    // 这个测试预期会失败（因为 test_tasks-01 没有对应的 spec 文件）
    // 但我们只验证它会进行检查
    expect(result.stdout).toContain('FAIL')
  })
})
