import { describe, it, expect } from 'vitest'

describe('e2e transition-two-helper-required', () => {
  function setupS1() {
    // 2.1.1 准备状态
    const s = 's1'
    // 2.1.2 状态期望 #期望: ['s1']
    expect(s).toBe('s1')
  }

  function transitionS1ToS2() {
    // 2.2.1 断言处于 s1 #期望: ['s1']
    const from = 's1'
    expect(from).toBe('s1')
    // 2.2.2 执行切换动作
    const to = 's2'
    // 2.2.3 断言处于 s2 #期望: ['s2']
    expect(to).toBe('s2')
  }

  it('2.1 状态: s1', () => {
    setupS1()
  })

  it('2.2 切换: s1 -> s2', () => {
    transitionS1ToS2()
  })

  it('3.1 Case: flow', () => {
    // 3.1.1 状态: s1
    setupS1()
    // 3.1.2 场景期望 #期望: [true]
    expect(true).toBe(true)
  })
})
