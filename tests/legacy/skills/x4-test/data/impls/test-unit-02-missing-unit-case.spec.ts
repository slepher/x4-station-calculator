import { describe, it, expect } from 'vitest'
describe('unit missing-unit-case', () => {
  it('1.2 Unit baseline', () => {
    // 1.1.1 准备单测输入
    const a = 1
    // 1.1.2 单测期望 #期望: [1]
    expect(a).toBe(1)
  })
})
