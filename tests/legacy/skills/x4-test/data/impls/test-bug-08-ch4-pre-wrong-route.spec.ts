import { describe, it } from 'vitest'
describe('bug pre-wrong-route', () => {
  it('4.1 BUG-001: baseline bug', () => {
    // 4.1.1 复现步骤
    const before = 'error'
    void before
  })
})
