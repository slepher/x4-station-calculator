import { describe, it, expect } from 'vitest'

describe('e2e missing-e2e-case', () => {
  function setupS1() {
    const s = 's1'
    expect(s).toBe('s1')
  }

  it('3.1 Case: flow', () => {
    // 3.1.1 状态: s1
    setupS1()
    // 3.1.2 场景期望 #期望: [true]
    const s = 's1'
    expect(s === 's1').toBe(true)
  })
})
