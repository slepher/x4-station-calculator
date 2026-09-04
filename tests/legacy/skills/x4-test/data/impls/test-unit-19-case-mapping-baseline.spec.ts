describe('1.1 Unit baseline', () => {
  // 1.1.1 准备单测输入
  it('1.1.1 准备单测输入', () => {
    const input = 1
    expect(input).toBeDefined()
  })

  // 1.1.2 单测期望 #期望: [1]
  it('1.1.2 单测期望', () => {
    expect(1).toBe(1)
  })
})
