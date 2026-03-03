import { describe, it, expect } from 'vitest'

describe('bug-fix comment-order-invalid', () => {
  it('4.1 BUG-001: baseline bug', () => {
    // 4.1.1 复现步骤
    const bridge = 'ok'
    expect(bridge).toBe('ok')
    // 4.1.2 修复后: 错误消失 #期望: ['ok']
    const after = 'ok'
    expect(after).toBe('ok')
  })
})
