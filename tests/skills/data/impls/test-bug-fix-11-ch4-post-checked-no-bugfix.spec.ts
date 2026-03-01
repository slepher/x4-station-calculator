import { describe, it } from 'vitest'
describe('bug-fix missing required case', () => {
  it('4.2 unrelated case', () => {
    const x = 1
    void x
  })
})
