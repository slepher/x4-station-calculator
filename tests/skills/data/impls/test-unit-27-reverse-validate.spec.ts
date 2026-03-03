// 1.1 正确位置的顶层任务
it('1.1 正确位置的顶层任务', () => {
  // 1.1.1 步骤描述
  expect(true).toBe(true)
})

// 1.2 没有出现在 test 中 - 错误位置
describe('1.2 错误位置的顶层任务', () => {
  it('测试', () => {
    expect(true).toBe(true)
  })
})
