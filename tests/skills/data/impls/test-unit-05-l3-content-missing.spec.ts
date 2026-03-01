import { describe, it, expect } from 'vitest'
describe('unit l3-content-missing', () => {
  it('1.1 Unit baseline', () => {
    // 1.1.1 输入处理
    // 1.1.1.1 子步骤A
    const a = 1
    // 1.1.1.2 子步骤B #期望: [2]
    expect(a).toBe(2)
    // 1.1.2 单测期望 #期望: [1]
    expect(a).toBe(1)
  })
})
