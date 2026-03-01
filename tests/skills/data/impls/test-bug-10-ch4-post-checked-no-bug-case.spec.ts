import { describe, it } from 'vitest'
describe('bug post checked no bug case', () => {
  it('4.2 unrelated case', () => {
    // unrelated
    const x = 1
    void x
  })
})
