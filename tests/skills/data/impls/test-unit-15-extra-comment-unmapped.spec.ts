import { describe, it, expect } from 'vitest'

describe('unit extra-comment-unmapped', () => {
  it('1.1 Unit baseline', () => {
    // 1.1.1 准备单测输入
    const a = 1
    // 1.1.2 单测期望 #期望: [1]
    expect(a).toBe(1)
    // 1.1.9 多余注释
    const ghost = 9
    expect(ghost).toBe(9)
  })
})
