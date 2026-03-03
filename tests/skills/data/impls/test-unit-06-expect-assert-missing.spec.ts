import { describe, it } from 'vitest'
describe('unit expect-assert-missing', () => {
  it('1.1 Unit baseline', () => {
    // 1.1.1 准备单测输入
    const a = 1
    // 1.1.2 单测期望 #期望: [1]
    const b = a + 1
    void b
  })
})
