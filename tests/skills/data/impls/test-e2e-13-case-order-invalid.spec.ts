import { describe, it, expect } from 'vitest'

describe('e2e case-order-invalid', () => {
  function setupS1() {
    // 2.1.1 准备状态
    const s = 's1'
    // 2.1.2 状态期望 #期望: ['s1']
    expect(s).toBe('s1')
  }

  it('3.1 Case: flow', () => {
    // 3.1.1 状态: s1
    setupS1()
    // 3.1.2 场景期望 #期望: [true]
    const s = 's1'
    expect(s === 's1').toBe(true)
  })

  it('2.1 状态: s1', () => {
    setupS1()
  })
})
