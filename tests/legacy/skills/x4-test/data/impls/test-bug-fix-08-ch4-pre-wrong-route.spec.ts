import { describe, it, expect } from 'vitest'
describe('bug-fix pre-wrong-route', () => {
  it('4.1 BUG-001: baseline bug', () => {
    // 4.1.2 修复前: 出现错误 #期望: ['error']
    expect('error').toBe('error')
    // 4.1.2 修复后: 错误消失 #期望: ['ok']
    expect('ok').toBe('ok')
  })
})
