import { describe, it, expect } from 'vitest'

describe('bug comment-order-invalid', () => {
  it('4.1 BUG-001: baseline bug', () => {
    // 4.1.1 复现步骤
    const before = 'error'
    // 4.1.2 修复前: 出现错误 #期望: ['error']
    expect(before).toBe('error')
  })
})
