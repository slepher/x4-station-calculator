import { describe, it, expect } from 'vitest'
describe('unit missing-comment', () => {
  it('1.1 Unit baseline', () => {
    // 1.1.1 准备单测输入
    const a = 1
    expect(a).toBe(1)
  })
})
