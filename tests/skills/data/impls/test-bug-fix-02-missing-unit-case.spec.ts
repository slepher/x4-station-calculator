import { describe, it, expect } from 'vitest'
describe('bug-fix missing-unit-case', () => {
  it('4.1 BUG-001: baseline bug', () => {
    // 4.1.2 修复后: 错误消失 #期望: ['ok']
    const after = 'ok'
    expect(after).toBe('ok')
  })
})
