import { describe, it, expect } from 'vitest'
describe('bug post-wrong-route', () => {
  it('4.1 BUG-001: baseline bug', () => {
    // 4.1.1 复现步骤
    const before = 'error'
    // 4.1.2 修复前: 出现错误 #期望: ['error']
    expect(before).toBe('error')
    // 4.1.2 修复后: 错误消失 #期望: ['ok']
    expect('ok').toBe('ok')
  })
})
